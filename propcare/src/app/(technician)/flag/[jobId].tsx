import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Camera } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { showDialog } from '@/components/dialog';
import { PrimaryButton } from '@/components/primary-button';
import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { flagVariation, getJob, listJobTypes, type Job, type JobType } from '@/lib/data';

const FINDINGS = ['Seized valve', 'Corroded pipework', 'Hidden leak', 'Other'];
/** Finding chips that map to a rate-card item give the office a suggested price. */
const FINDING_TO_JOB_TYPE: Record<string, string> = {
  'Seized valve': 'Replace isolator valve',
};

/** Flag extra work — 30 seconds, wet hands (design T3). The office prices it, never the tech. */
export default function FlagVariation() {
  const { colors: c, status } = usePalette();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [finding, setFinding] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [extraTime, setExtraTime] = useState<string | null>(null);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getJob(jobId).then(setJob);
    listJobTypes().then(setJobTypes).catch(() => {});
  }, [jobId]);

  async function addPhoto() {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 }).catch(() =>
      ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.7 }),
    );
    if (!result.canceled && result.assets[0]) {
      setPhotoUris((p) => [...p, result.assets[0].uri]);
    }
  }

  async function send() {
    if (!job) return;
    setSending(true);
    try {
      const mappedName = finding ? FINDING_TO_JOB_TYPE[finding] : undefined;
      const suggested = mappedName
        ? jobTypes.find((t) => t.name === mappedName)?.price_inc_vat
        : undefined;
      const fullNote = [finding && finding !== 'Other' ? finding : null, note.trim(), extraTime ? `Est. ${extraTime}` : null]
        .filter(Boolean)
        .join(' — ');
      await flagVariation(job, { note: fullNote || 'Extra work found', photoUris, suggestedPrice: suggested });
      router.back();
    } catch (e) {
      showDialog('Could not send', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 20, gap: 14, flexGrow: 1 }}>
      <View
        style={{
          backgroundColor: status.amber.bg,
          borderRadius: Radius.card,
          borderCurve: 'continuous',
          padding: 13,
        }}>
        <Text style={{ fontSize: 13.5, color: status.amber.fg, fontWeight: '600', lineHeight: 20 }}>
          The job pauses while the office prices this and the landlord approves. Keep working on
          the original job if you can.
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: c.text }}>1 · Photos of the problem</Text>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {photoUris.map((uri) => (
            <Image key={uri} source={{ uri }} style={{ width: 110, height: 110, borderRadius: 12 }} contentFit="cover" />
          ))}
          <Pressable
            onPress={addPhoto}
            style={{
              width: 110,
              height: 110,
              borderRadius: 12,
              borderCurve: 'continuous',
              borderWidth: 2.5,
              borderStyle: 'dashed',
              borderColor: c.primary,
              backgroundColor: c.primaryTint,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}>
            <Camera size={28} color={c.primary} />
            <Text style={{ fontSize: 14, fontWeight: '800', color: c.primary }}>Add photo</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: c.text }}>2 · What did you find?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {FINDINGS.map((f) => {
            const sel = finding === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFinding(f)}
                style={{
                  backgroundColor: sel ? c.primary : c.backgroundElement,
                  borderWidth: sel ? 0 : 1.5,
                  borderColor: c.border,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: Radius.chip,
                  minHeight: 44,
                  justifyContent: 'center',
                }}>
                <Text style={{ fontSize: 14, fontWeight: sel ? '700' : '600', color: sel ? c.onPrimary : c.textSecondary }}>
                  {f}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Say what needs doing — dictation works well here"
          placeholderTextColor={c.textTertiary}
          multiline
          style={{
            backgroundColor: c.backgroundElement,
            borderWidth: 1.5,
            borderColor: c.inputBorder,
            borderRadius: Radius.card,
            borderCurve: 'continuous',
            padding: 14,
            minHeight: 76,
            fontSize: 15,
            color: c.text,
            textAlignVertical: 'top',
          }}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: c.text }}>3 · Rough extra time</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {['+30 min', '+1 hour', '+2 hours'].map((t) => {
            const sel = extraTime === t;
            return (
              <Pressable
                key={t}
                onPress={() => setExtraTime(t)}
                style={{
                  flex: 1,
                  backgroundColor: sel ? c.primary : c.backgroundElement,
                  borderWidth: sel ? 0 : 1.5,
                  borderColor: c.border,
                  borderRadius: Radius.card,
                  borderCurve: 'continuous',
                  minHeight: 52,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text style={{ fontSize: 15, fontWeight: sel ? '800' : '700', color: sel ? c.onPrimary : c.textSecondary }}>
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ marginTop: 'auto', gap: 8 }}>
        <PrimaryButton
          label="Send to office"
          disabled={photoUris.length === 0 && !note.trim() && !finding}
          loading={sending}
          onPress={send}
        />
        <Text style={{ fontSize: 12.5, color: c.textTertiary, textAlign: 'center' }}>
          The office sets the price — you never quote on site.
        </Text>
      </View>
    </ScrollView>
  );
}
