import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { STATUS, statusLabel, type JobStatus } from '@/lib/job-status';

type Props = {
  status: JobStatus;
  /** Overrides the default plain-English label, e.g. "Booked for Tue 14/07" */
  label?: string;
  technicianFirstName?: string;
};

/**
 * Status chip: tinted, never filled — the label does the talking.
 * The dot pulses only while work is live (design system rule).
 */
export function StatusChip({ status, label, technicianFirstName }: Props) {
  const { status: statusPalette } = usePalette();
  const { hue, live } = STATUS[status];
  const colors = statusPalette[hue];
  const text = label ?? statusLabel(status, technicianFirstName);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        alignSelf: 'flex-start',
        backgroundColor: colors.bg,
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: Radius.chip,
      }}>
      {live ? <PulsingDot color={colors.dot} /> : <Dot color={colors.dot} />}
      <Text style={{ color: colors.fg, fontSize: 13, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

function Dot({ color }: { color: string }) {
  return <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />;
}

function PulsingDot({ color }: { color: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }),
      -1,
    );
  }, [progress]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - progress.value),
    transform: [{ scale: 1 + progress.value * 1.6 }],
  }));

  return (
    <View style={{ width: 8, height: 8, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: color,
          },
          halo,
        ]}
      />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}
