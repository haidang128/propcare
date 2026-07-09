import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { BadgePlus, Camera, CheckCheck, Pause, Play } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { showDialog } from '@/components/dialog';
import { PrimaryButton } from '@/components/primary-button';
import { StatusChip } from '@/components/status-chip';
import { usePalette } from '@/hooks/use-palette';
import {
  addTimeMaterial,
  getJob,
  listTimeMaterials,
  transitionJobStatus,
  uploadJobPhoto,
  type Job,
  type TimeMaterial,
} from '@/lib/data';
import { formatGBP, type JobStatus } from '@/lib/job-status';

/**
 * Active job — one-tap status updates, oversized targets, before/after photos
 * (design T2). One decision per screen; usable one-handed with wet hands.
 */
export default function TechnicianJob() {
  const { colors: c, status } = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<{ before?: string; after?: string }>({});
  const [materials, setMaterials] = useState<TimeMaterial[]>([]);

  const load = useCallback(() => {
    getJob(id).then(setJob);
    listTimeMaterials(id).then(setMaterials).catch(() => {});
  }, [id]);

  useEffect(load, [load]);
  useFocusEffect(load); // refresh when returning from the flag sheet

  async function move(to: JobStatus) {
    if (!job) return;
    setBusy(true);
    try {
      await transitionJobStatus(job.id, to);
      load();
    } catch (e) {
      showDialog('Could not update status', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function capture(kind: 'before' | 'after') {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 }).catch(() =>
      ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.7 }),
    );
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    setPhotos((p) => ({ ...p, [kind]: uri }));
    if (job) {
      try {
        await uploadJobPhoto(job.id, uri, kind);
      } catch {
        // photo is kept locally; upload retries can come later
      }
    }
  }

  if (!job) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  const canStart = job.status === 'scheduled';
  const started = job.status === 'in_progress';
  const paused = job.status === 'awaiting_parts';

  return (
    <>
      <Stack.Screen options={{ title: job.reference }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ padding: 20, gap: 14, flexGrow: 1 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 19, fontWeight: '800', color: c.text }}>
            {job.job_type?.name ?? 'Job'}
          </Text>
          <Text style={{ fontSize: 13.5, color: c.textSecondary }}>
            {job.property?.address_line1} · {job.reference}
          </Text>
          <View style={{ marginTop: 4 }}>
            <StatusChip status={job.status} />
          </View>
        </View>

        {/* One-tap status grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <BigAction
            label={started ? 'Started' : 'Start job'}
            icon={<Play size={24} color={started ? status.green.fg : canStart ? c.primary : c.textTertiary} />}
            active={started}
            activeColor={status.green.dot}
            disabled={!canStart || busy}
            onPress={() => move('in_progress')}
          />
          <BigAction
            label={paused ? 'Resume' : 'Pause — parts'}
            icon={<Pause size={24} color={status.purple.fg} />}
            active={paused}
            activeColor={status.purple.dot}
            disabled={(!started && !paused) || busy}
            onPress={() => move(paused ? 'in_progress' : 'awaiting_parts')}
          />
          <BigAction
            label={job.status === 'variation_pending' ? 'Awaiting approval' : 'Flag extra work'}
            icon={<BadgePlus size={24} color={status.amber.fg} />}
            active={job.status === 'variation_pending'}
            activeColor={status.amber.dot}
            disabled={!started || busy}
            onPress={() => router.push({ pathname: '/(technician)/flag/[jobId]', params: { jobId: job.id } })}
          />
        </View>

        {/* Before / after photos */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
            Photos — before &amp; after required
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['before', 'after'] as const).map((kind) => (
              <Pressable
                key={kind}
                onPress={() => capture(kind)}
                style={{
                  flex: 1,
                  height: 110,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  borderWidth: photos[kind] ? 0 : 2.5,
                  borderStyle: 'dashed',
                  borderColor: c.primary,
                  backgroundColor: photos[kind] ? undefined : c.primaryTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  overflow: 'hidden',
                }}>
                {photos[kind] ? (
                  <Image source={{ uri: photos[kind] }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                ) : (
                  <>
                    <Camera size={26} color={c.primary} />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: c.primary }}>
                      {kind === 'before' ? 'Before photo' : 'After photo'}
                    </Text>
                  </>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        <MaterialsLog
          materials={materials}
          onAdd={async (description, cost) => {
            await addTimeMaterial(job.id, { description, cost });
            load();
          }}
        />

        <View style={{ marginTop: 'auto', gap: 8 }}>
          <PrimaryButton
            label="Mark job done"
            disabled={!started || !photos.after}
            loading={busy}
            onPress={() =>
              showDialog('Finish this job?', 'The landlord will be asked to confirm and pay.', [
                { text: 'Not yet', style: 'cancel' },
                { text: 'Mark done', onPress: () => move('completed') },
              ])
            }
          />
          {!photos.after && started ? (
            <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
              <CheckCheck size={14} color={c.textTertiary} />
              <Text style={{ fontSize: 12, color: c.textTertiary }}>
                Add the after photo to finish the job
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}

function MaterialsLog({
  materials,
  onAdd,
}: {
  materials: TimeMaterial[];
  onAdd: (description: string, cost?: number) => Promise<void>;
}) {
  const { colors: c } = usePalette();
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!description.trim()) return;
    setSaving(true);
    try {
      const parsed = parseFloat(cost.replace(',', '.'));
      await onAdd(description.trim(), Number.isFinite(parsed) ? parsed : undefined);
      setDescription('');
      setCost('');
    } catch (e) {
      showDialog('Could not add material', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View
      style={{
        backgroundColor: c.backgroundElement,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 14,
        borderCurve: 'continuous',
        padding: 16,
        gap: 10,
      }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>Time &amp; materials log</Text>
        <Text style={{ fontSize: 11.5, fontWeight: '600', color: c.textTertiary }}>
          internal — landlord sees fixed price only
        </Text>
      </View>

      {materials.map((m) => (
        <View key={m.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
          <Text style={{ flex: 1, fontSize: 14, color: c.textSecondary }}>{m.description}</Text>
          {m.cost != null ? (
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, fontVariant: ['tabular-nums'] }}>
              {formatGBP(m.cost)}
            </Text>
          ) : null}
        </View>
      ))}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Material or note"
          placeholderTextColor={c.textTertiary}
          style={{
            flex: 1,
            backgroundColor: c.background,
            borderWidth: 1.5,
            borderColor: c.inputBorder,
            borderRadius: 10,
            borderCurve: 'continuous',
            paddingVertical: 11,
            paddingHorizontal: 12,
            fontSize: 14,
            color: c.text,
          }}
        />
        <TextInput
          value={cost}
          onChangeText={setCost}
          placeholder="£"
          placeholderTextColor={c.textTertiary}
          keyboardType="decimal-pad"
          style={{
            width: 76,
            backgroundColor: c.background,
            borderWidth: 1.5,
            borderColor: c.inputBorder,
            borderRadius: 10,
            borderCurve: 'continuous',
            paddingVertical: 11,
            paddingHorizontal: 12,
            fontSize: 14,
            color: c.text,
          }}
        />
        <Pressable
          onPress={add}
          disabled={saving || !description.trim()}
          style={{
            minWidth: 52,
            minHeight: 44,
            backgroundColor: c.primary,
            borderRadius: 10,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: !description.trim() ? 0.5 : 1,
          }}>
          <Text style={{ color: c.onPrimary, fontSize: 20, fontWeight: '800' }}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BigAction({
  label,
  icon,
  active,
  activeColor,
  disabled,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  activeColor: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors: c } = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flexGrow: 1,
        minWidth: '45%',
        minHeight: 74,
        backgroundColor: c.backgroundElement,
        borderWidth: active ? 2 : 1.5,
        borderColor: active ? activeColor : c.border,
        borderRadius: 14,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        opacity: disabled && !active ? 0.55 : 1,
      }}>
      {icon}
      <Text style={{ fontSize: 14, fontWeight: active ? '800' : '700', color: active ? activeColor : c.textSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}
