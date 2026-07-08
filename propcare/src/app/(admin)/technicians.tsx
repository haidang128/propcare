import { useFocusEffect } from 'expo-router';
import { LockKeyhole, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { listRegistryTechnicians, type Certification, type RegistryTechnician } from '@/lib/data';

function certState(cert: Certification): 'valid' | 'renew' | 'expired' {
  const days = Math.ceil((new Date(cert.expires_on).getTime() - Date.now()) / 86400000);
  return days < 0 ? 'expired' : days <= 60 ? 'renew' : 'valid';
}

const TRADE_CERTS = ['niceic', 'napit', 'gas_safe'] as const;

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

  const blocked = (technicians ?? []).filter((t) =>
    t.certifications.some((cert) => TRADE_CERTS.includes(cert.type as any) && certState(cert) === 'expired'),
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 20, gap: 12, maxWidth: 800, width: '100%', alignSelf: 'center' }}>
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
              gap: 8,
            }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>{tech.full_name}</Text>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
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
                {isBlocked ? (
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
            {tech.certifications.length === 0 ? (
              <Text style={{ fontSize: 12.5, color: c.textTertiary }}>No documents on file yet.</Text>
            ) : (
              tech.certifications.map((cert, i) => {
                const state = certState(cert);
                const pal = state === 'expired' ? status.red : state === 'renew' ? status.amber : status.green;
                const Icon = state === 'expired' ? ShieldX : state === 'renew' ? ShieldAlert : ShieldCheck;
                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon size={15} color={pal.dot} />
                    <Text style={{ flex: 1, fontSize: 13, color: c.textSecondary }}>
                      {cert.type.toUpperCase().replace('_', ' ')}
                      {cert.verified ? '' : ' (unverified)'}
                    </Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '600', color: pal.fg, fontVariant: ['tabular-nums'] }}>
                      {state === 'expired' ? 'expired ' : ''}
                      {new Date(cert.expires_on).toLocaleDateString('en-GB')}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        );
      })}
      {technicians !== null && technicians.length === 0 ? (
        <Text style={{ fontSize: 13.5, color: c.textSecondary, textAlign: 'center', padding: 16 }}>
          No technicians yet — set a user&apos;s role to &quot;technician&quot; in profiles, then
          record their certifications.
        </Text>
      ) : null}
    </ScrollView>
  );
}
