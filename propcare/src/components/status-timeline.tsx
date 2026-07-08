import { Check } from 'lucide-react-native';
import React from 'react';
import { Text, View } from 'react-native';

import { usePalette } from '@/hooks/use-palette';

export type TimelineStep = {
  title: string;
  detail?: string;
  state: 'done' | 'current' | 'upcoming';
  /** current steps default to green (live); pass 'blue' for in-hand waits */
  currentHue?: 'green' | 'blue';
};

/**
 * The status timeline — the heartbeat of the product, reused across
 * landlord, technician, and admin views (design system component).
 */
export function StatusTimeline({ steps }: { steps: TimelineStep[] }) {
  const { scheme, colors: c, status } = usePalette();
  const green = status.green.dot;
  const blue = status.blue.dot;

  return (
    <View>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const accent = step.currentHue === 'blue' ? blue : green;
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 14 }}>
            <View style={{ alignItems: 'center' }}>
              {step.state === 'done' ? (
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: green,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Check size={13} color={scheme === 'dark' ? '#10161D' : '#FFFFFF'} strokeWidth={3.5} />
                </View>
              ) : (
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: c.backgroundElement,
                    borderWidth: step.state === 'current' ? 2.5 : 2,
                    borderColor: step.state === 'current' ? accent : c.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {step.state === 'current' ? (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
                  ) : null}
                </View>
              )}
              {!isLast ? (
                <View
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 18,
                    backgroundColor: step.state === 'done' ? green : c.border,
                  }}
                />
              ) : null}
            </View>
            <View style={{ paddingBottom: isLast ? 0 : 16, flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: step.state === 'upcoming' ? '600' : '700',
                  color:
                    step.state === 'upcoming'
                      ? c.textTertiary
                      : step.state === 'current'
                        ? accent
                        : c.text,
                }}>
                {step.title}
              </Text>
              {step.detail ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: step.state === 'upcoming' ? c.textTertiary : c.textSecondary,
                    marginTop: 1,
                  }}>
                  {step.detail}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
