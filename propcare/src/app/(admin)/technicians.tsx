import { useFocusEffect } from 'expo-router';
import {
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Trash2,
  UserPlus,
  UserRoundX,
  Undo2,
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { showDialog } from '@/components/dialog';
import { PrimaryButton } from '@/components/primary-button';
import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { shareText } from '@/lib/share';
import {
  addCertification,
  inviteTechnician,
  listRegistryTechnicians,
  removeCertification,
  setTechnicianOnRoster,
  setTechnicianPayRate,
  updateTechnician,
  type Certification,
  type CertificationType,
  type RegistryTechnician,
} from '@/lib/data';

function certState(cert: Certification): 'valid' | 'renew' | 'expired' {
  const days = Math.ceil((new Date(cert.expires_on).getTime() - Date.now()) / 86400000);
  return days < 0 ? 'expired' : days <= 60 ? 'renew' : 'valid';
}

const TRADE_CERTS = ['niceic', 'napit', 'gas_safe'] as const;

const CERT_TYPES: { key: CertificationType; label: string }[] = [
  { key: 'niceic', label: 'NICEIC' },
  { key: 'napit', label: 'NAPIT' },
  { key: 'gas_safe', label: 'Gas Safe' },
  { key: 'wras', label: 'WRAS' },
  { key: 'public_liability', label: 'Public liability' },
  { key: 'other', label: 'Other' },
];

/** DD/MM/YYYY — how a certificate actually reads — into the date the DB wants. */
function parseUkDate(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : iso;
}

function Field({
  label,
  value,
  onCommit,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'decimal-pad';
}) {
  const { colors: c } = usePalette();
  const [draft, setDraft] = useState(value);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ width: 92, fontSize: 13, color: c.textSecondary }}>{label}</Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onBlur={() => draft !== value && onCommit(draft)}
        onSubmitEditing={() => draft !== value && onCommit(draft)}
        placeholder={placeholder}
        placeholderTextColor={c.textTertiary}
        keyboardType={keyboardType}
        style={{
          flex: 1,
          borderWidth: 1.5,
          borderColor: c.border,
          borderRadius: 8,
          borderCurve: 'continuous',
          paddingVertical: 6,
          paddingHorizontal: 10,
          fontSize: 13.5,
          color: c.text,
          backgroundColor: c.background,
        }}
      />
    </View>
  );
}

/**
 * Cost per hour. Kept for the effective-hourly-rate read-out on Admin → Gate:
 * labour cost itself is the technician payout share of the price (0017), not
 * this rate, so an empty one no longer hides margin.
 */
function PayRateRow({ tech, onSaved }: { tech: RegistryTechnician; onSaved: () => void }) {
  const { colors: c, status } = usePalette();
  const [value, setValue] = useState(tech.pay_rate_per_hour?.toString() ?? '');

  async function commit() {
    const trimmed = value.trim();
    const parsed = trimmed === '' ? null : Number(trimmed.replace(',', '.'));
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      showDialog('That rate looks wrong', 'Enter an hourly cost like 32.50, or clear it.');
      setValue(tech.pay_rate_per_hour?.toString() ?? '');
      return;
    }
    if (parsed === tech.pay_rate_per_hour) return;
    try {
      await setTechnicianPayRate(tech.id, parsed);
      onSaved();
    } catch (e) {
      showDialog('Could not save the rate', e instanceof Error ? e.message : 'Try again.');
    }
  }

  const missing = tech.pay_rate_per_hour == null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ width: 92, fontSize: 13, color: missing ? status.amber.fg : c.textSecondary }}>
        Benchmark £/h
      </Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        onBlur={commit}
        onSubmitEditing={commit}
        placeholder="0.00"
        placeholderTextColor={c.textTertiary}
        keyboardType="decimal-pad"
        style={{
          flex: 1,
          borderWidth: 1.5,
          borderColor: missing ? status.amber.dot : c.border,
          borderRadius: 8,
          borderCurve: 'continuous',
          paddingVertical: 6,
          paddingHorizontal: 10,
          fontSize: 13.5,
          fontWeight: '700',
          color: c.text,
          fontVariant: ['tabular-nums'],
          backgroundColor: c.background,
        }}
      />
    </View>
  );
}

/** Record a document. The expiry drives the assignment block, so it is required. */
function AddCertificationForm({ tech, onSaved }: { tech: RegistryTechnician; onSaved: () => void }) {
  const { colors: c } = usePalette();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CertificationType>('niceic');
  const [reference, setReference] = useState('');
  const [expires, setExpires] = useState('');
  const [verified, setVerified] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    const expires_on = parseUkDate(expires);
    if (!expires_on) {
      showDialog('Check the expiry date', 'Enter it as DD/MM/YYYY, for example 14/07/2027.');
      return;
    }
    setSaving(true);
    try {
      await addCertification(tech.id, { type, expires_on, reference, verified });
      setOpen(false);
      setReference('');
      setExpires('');
      setVerified(false);
      onSaved();
    } catch (e) {
      showDialog('Could not save the document', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} hitSlop={6}>
        <Text style={{ fontSize: 12.5, fontWeight: '700', color: c.primary }}>＋ Add document</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: 8, backgroundColor: c.background, borderRadius: 10, padding: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {CERT_TYPES.map((t) => {
          const on = type === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setType(t.key)}
              style={{
                backgroundColor: on ? c.primary : c.backgroundElement,
                borderWidth: on ? 0 : 1,
                borderColor: c.border,
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: Radius.chip,
              }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: on ? c.onPrimary : c.text }}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Field label="Reference" value={reference} onCommit={setReference} placeholder="optional" />
      <Field label="Expires" value={expires} onCommit={setExpires} placeholder="DD/MM/YYYY" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ width: 92, fontSize: 13, color: c.textSecondary }}>Verified</Text>
        <Switch value={verified} onValueChange={setVerified} />
        <Text style={{ flex: 1, fontSize: 11.5, color: c.textTertiary, lineHeight: 16 }}>
          Only a verified, in-date NICEIC or NAPIT unlocks electrical work.
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={() => setOpen(false)} hitSlop={6} style={{ justifyContent: 'center' }}>
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: c.textSecondary }}>Cancel</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="Save document" loading={saving} onPress={save} />
        </View>
      </View>
    </View>
  );
}

/** Add someone to the roster: creates their login and hands back a sign-in link. */
function AddTechnicianForm({ onAdded }: { onAdded: () => void }) {
  const { colors: c } = usePalette();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!fullName.trim() || !email.includes('@')) {
      showDialog('Name and email are needed', 'The email becomes their login.');
      return;
    }
    setSaving(true);
    try {
      const { signInLink, alreadyExisted } = await inviteTechnician({
        email: email.trim(),
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
      });
      setOpen(false);
      setFullName('');
      setEmail('');
      setPhone('');
      onAdded();
      showDialog(
        alreadyExisted ? 'Existing account moved to technician' : 'Technician added',
        signInLink
          ? `Send ${fullName.trim()} this one-time sign-in link:\n\n${signInLink}`
          : `${fullName.trim()} can now sign in with their email address.`,
        signInLink
          ? [
              {
                text: 'Share…',
                onPress: () =>
                  shareText(signInLink, { title: 'Sign-in link', copiedTitle: 'Link copied' }),
              },
              { text: 'Done' },
            ]
          : undefined,
      );
    } catch (e) {
      showDialog('Could not add them', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          minHeight: 46,
          borderRadius: Radius.button,
          borderCurve: 'continuous',
          borderWidth: 1.5,
          borderColor: c.primary,
        }}>
        <UserPlus size={17} color={c.primary} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.primary }}>Add technician</Text>
      </Pressable>
    );
  }

  return (
    <View
      style={{
        gap: 8,
        backgroundColor: c.backgroundElement,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: Radius.card,
        borderCurve: 'continuous',
        padding: 14,
      }}>
      <Text style={{ fontSize: 14, fontWeight: '800', color: c.text }}>New technician</Text>
      <Field label="Name" value={fullName} onCommit={setFullName} placeholder="Sam Okafor" />
      <Field label="Email" value={email} onCommit={setEmail} placeholder="sam@example.com" />
      <Field label="Phone" value={phone} onCommit={setPhone} placeholder="07700 900101" keyboardType="phone-pad" />
      <Text style={{ fontSize: 11.5, color: c.textTertiary, lineHeight: 16 }}>
        Creates their login and puts them on the roster. They still need documents on file before
        they can take electrical work.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={() => setOpen(false)} hitSlop={6} style={{ justifyContent: 'center' }}>
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: c.textSecondary }}>Cancel</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <PrimaryButton label="Add to roster" loading={saving} onPress={save} />
        </View>
      </View>
    </View>
  );
}

/** Technician registry — expired documents visibly block assignment (design A4). */
export default function TechnicianRegistry() {
  const { colors: c, status } = usePalette();
  const [technicians, setTechnicians] = useState<RegistryTechnician[] | null>(null);

  const load = useCallback(async () => {
    try {
      setTechnicians(await listRegistryTechnicians());
    } catch {
      setTechnicians([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const active = (technicians ?? []).filter((t) => !t.deactivated_at);
  const blocked = active.filter((t) =>
    t.certifications.some((cert) => TRADE_CERTS.includes(cert.type as any) && certState(cert) === 'expired'),
  );

  async function confirmRemove(tech: RegistryTechnician) {
    showDialog(
      `Take ${tech.full_name.split(' ')[0]} off the roster?`,
      'Their finished jobs and invoices stay exactly as they are. They just stop appearing when you assign work, and cannot be assigned by mistake.',
      [
        { text: 'Keep them' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await setTechnicianOnRoster(tech.id, false);
              load();
            } catch (e) {
              showDialog('Could not remove them', e instanceof Error ? e.message : 'Try again.');
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 20, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' }}>
      <AddTechnicianForm onAdded={load} />

      <Text style={{ fontSize: 13, color: c.textSecondary }}>
        Expired trade documents automatically block assignment for the affected category — enforced
        by the database, not just this screen.
      </Text>

      {blocked.length > 0 ? (
        <View
          style={{
            backgroundColor: status.red.bg,
            borderRadius: Radius.card,
            borderCurve: 'continuous',
            padding: 13,
            flexDirection: 'row',
            gap: 9,
          }}>
          <ShieldAlert size={17} color={status.red.fg} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: status.red.fg, lineHeight: 20 }}>
            {blocked.length} technician{blocked.length > 1 ? 's' : ''} blocked:{' '}
            {blocked.map((t) => t.full_name).join(', ')} — certification expired. They can&apos;t
            receive jobs in that trade until a valid document is recorded.
          </Text>
        </View>
      ) : null}

      {(technicians ?? []).map((tech) => {
        const isBlocked = blocked.some((b) => b.id === tech.id);
        const off = !!tech.deactivated_at;
        return (
          <View
            key={tech.id}
            style={{
              backgroundColor: isBlocked ? status.red.bg : c.backgroundElement,
              borderWidth: 1,
              borderColor: isBlocked ? status.red.dot : c.border,
              borderRadius: Radius.card,
              borderCurve: 'continuous',
              padding: 14,
              gap: 9,
              opacity: off ? 0.6 : 1,
            }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{tech.full_name}</Text>
                {tech.email ? (
                  <Text style={{ fontSize: 12, color: c.textTertiary }}>{tech.email}</Text>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                {off ? null : (
                  <View
                    style={{
                      backgroundColor: tech.on_call ? status.green.bg : c.background,
                      paddingVertical: 3,
                      paddingHorizontal: 9,
                      borderRadius: Radius.chip,
                    }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: tech.on_call ? status.green.fg : c.textTertiary }}>
                      {tech.on_call ? 'On call' : 'Not on call'}
                    </Text>
                  </View>
                )}
                {off ? (
                  <View style={{ backgroundColor: c.background, paddingVertical: 3, paddingHorizontal: 9, borderRadius: Radius.chip }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: c.textTertiary }}>
                      Off the roster
                    </Text>
                  </View>
                ) : isBlocked ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: status.red.dot,
                      paddingVertical: 3,
                      paddingHorizontal: 9,
                      borderRadius: Radius.chip,
                    }}>
                    <LockKeyhole size={11} color="#FFFFFF" />
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#FFFFFF' }}>Blocked</Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: status.green.bg, paddingVertical: 3, paddingHorizontal: 9, borderRadius: Radius.chip }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: status.green.fg }}>Active</Text>
                  </View>
                )}
              </View>
            </View>

            <Field
              label="Name"
              value={tech.full_name}
              onCommit={async (full_name) => {
                if (!full_name.trim()) return;
                try {
                  await updateTechnician(tech.id, { full_name: full_name.trim() });
                  load();
                } catch (e) {
                  showDialog('Could not save', e instanceof Error ? e.message : 'Try again.');
                }
              }}
            />
            <Field
              label="Phone"
              value={tech.phone ?? ''}
              placeholder="07700 900101"
              keyboardType="phone-pad"
              onCommit={async (phone) => {
                try {
                  await updateTechnician(tech.id, { phone: phone.trim() || null });
                  load();
                } catch (e) {
                  showDialog('Could not save', e instanceof Error ? e.message : 'Try again.');
                }
              }}
            />
            <PayRateRow tech={tech} onSaved={load} />

            {tech.certifications.length === 0 ? (
              <Text style={{ fontSize: 12.5, color: c.textTertiary }}>No documents on file yet.</Text>
            ) : (
              tech.certifications.map((cert, i) => {
                const state = certState(cert);
                const pal = state === 'expired' ? status.red : state === 'renew' ? status.amber : status.green;
                const Icon = state === 'expired' ? ShieldX : state === 'renew' ? ShieldAlert : ShieldCheck;
                return (
                  <View key={cert.id ?? i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon size={15} color={pal.dot} />
                    <Text style={{ flex: 1, fontSize: 13, color: c.textSecondary }}>
                      {cert.type.toUpperCase().replace('_', ' ')}
                      {cert.verified ? '' : ' (unverified)'}
                    </Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '600', color: pal.fg, fontVariant: ['tabular-nums'] }}>
                      {state === 'expired' ? 'expired ' : ''}
                      {new Date(cert.expires_on).toLocaleDateString('en-GB')}
                    </Text>
                    {cert.id ? (
                      <Pressable
                        hitSlop={8}
                        onPress={() =>
                          showDialog(
                            'Remove this document?',
                            'If it is the only valid NICEIC or NAPIT on file, they immediately stop being assignable to electrical work.',
                            [
                              { text: 'Keep it' },
                              {
                                text: 'Remove',
                                style: 'destructive',
                                onPress: async () => {
                                  try {
                                    await removeCertification(cert.id!);
                                    load();
                                  } catch (e) {
                                    showDialog(
                                      'Could not remove it',
                                      e instanceof Error ? e.message : 'Try again.',
                                    );
                                  }
                                },
                              },
                            ],
                          )
                        }>
                        <Trash2 size={14} color={c.textTertiary} />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            )}

            <AddCertificationForm tech={tech} onSaved={load} />

            <Pressable
              onPress={async () => {
                if (off) {
                  try {
                    await setTechnicianOnRoster(tech.id, true);
                    load();
                  } catch (e) {
                    showDialog('Could not restore them', e instanceof Error ? e.message : 'Try again.');
                  }
                } else {
                  confirmRemove(tech);
                }
              }}
              hitSlop={6}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
              {off ? <Undo2 size={14} color={c.primary} /> : <UserRoundX size={14} color={status.red.fg} />}
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: off ? c.primary : status.red.fg }}>
                {off ? 'Put back on the roster' : 'Remove from roster'}
              </Text>
            </Pressable>
          </View>
        );
      })}

      {technicians !== null && technicians.length === 0 ? (
        <Text style={{ fontSize: 13.5, color: c.textSecondary, textAlign: 'center', padding: 16 }}>
          No technicians yet — add the first one above.
        </Text>
      ) : null}
    </ScrollView>
  );
}
