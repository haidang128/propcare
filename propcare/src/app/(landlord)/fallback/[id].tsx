import { useLocalSearchParams } from 'expo-router';
import { Droplets, Phone } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { usePalette } from '@/hooks/use-palette';
import { getJob, type Job } from '@/lib/data';
import { shareText } from '@/lib/share';

const STEPS = [
  'Find the stopcock — usually under the kitchen sink or by the front door.',
  'Turn it clockwise until it stops. Open the cold kitchen tap to drain pressure.',
  'If water is near electrics, switch off the affected circuit at the consumer unit.',
];

/**
 * Out-of-hours fallback — calm, useful guidance when no on-call engineer
 * accepts (design 03 F). Water shut-off steps + National Gas Emergency line.
 */
export default function EmergencyFallback() {
  const { colors: c, status } = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    getJob(id).then(setJob);
  }, [id]);

  const tenantFirst = job?.property?.tenant_name?.split(' ')[0];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 20, gap: 14 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>
          While you wait for an engineer
        </Text>
        <Text style={{ fontSize: 14, color: c.textSecondary, lineHeight: 21 }}>
          You haven&apos;t been charged. Here&apos;s how to make things safe right now — and your
          request stays first in the queue.
        </Text>
      </View>

      <View
        style={{
          backgroundColor: c.backgroundElement,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 14,
          borderCurve: 'continuous',
          padding: 16,
          gap: 12,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <Droplets size={20} color={c.primary} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>Stop the water now</Text>
        </View>
        {STEPS.map((step, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: c.primaryTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: c.primary }}>{i + 1}</Text>
            </View>
            <Text style={{ flex: 1, fontSize: 14, color: c.text, lineHeight: 21 }}>{step}</Text>
          </View>
        ))}
        {tenantFirst ? (
          <Pressable
            onPress={() => shareText(`Urgent — until the engineer arrives:\n${STEPS.map((s, i) => `${i + 1}. ${s}`).join('\n')}`)}
            style={{
              borderWidth: 1.5,
              borderColor: c.primary,
              borderRadius: 10,
              borderCurve: 'continuous',
              minHeight: 46,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.primary }}>
              Send these steps to {tenantFirst}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View
        style={{
          backgroundColor: status.red.bg,
          borderRadius: 14,
          borderCurve: 'continuous',
          padding: 16,
          gap: 8,
        }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: status.red.fg }}>
          Smell gas? That&apos;s an emergency.
        </Text>
        <Text style={{ fontSize: 13.5, color: status.red.fg, lineHeight: 20 }}>
          Call the National Gas Emergency line now — free, 24 hours.
        </Text>
        <Pressable
          onPress={() => Linking.openURL('tel:0800111999')}
          style={{
            backgroundColor: status.red.dot,
            minHeight: 50,
            borderRadius: 10,
            borderCurve: 'continuous',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
          }}>
          <Phone size={18} color="#FFFFFF" />
          <Text selectable style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
            0800 111 999
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
