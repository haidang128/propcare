import React from 'react';
import { Text } from 'react-native';

import { usePalette } from '@/hooks/use-palette';

/** "Step n of 5" header badge for the new-request wizard. */
export function StepBadge({ label }: { label: string }) {
  const { colors: c } = usePalette();
  return <Text style={{ fontSize: 13, fontWeight: '600', color: c.textTertiary }}>{label}</Text>;
}
