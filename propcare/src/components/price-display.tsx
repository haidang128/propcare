import { LockKeyhole } from 'lucide-react-native';
import React from 'react';
import { Text, View } from 'react-native';

import { usePalette } from '@/hooks/use-palette';
import { formatGBP } from '@/lib/job-status';

type Props = {
  amount: number;
  /** Hero = the price-approval moment; inline = rows and cards */
  variant?: 'hero' | 'inline' | 'superseded';
  caption?: string;
};

/**
 * Fixed prices always render large, tabular, and locked (design system rule).
 * The default hero caption carries the "no surprise bills" promise.
 */
export function PriceDisplay({ amount, variant = 'inline', caption }: Props) {
  const { colors: c } = usePalette();

  if (variant === 'hero') {
    const [pounds, pence] = formatGBP(amount).split('.');
    return (
      <View
        style={{
          backgroundColor: c.primaryTint,
          borderWidth: 1.5,
          borderColor: c.primaryTintBorder,
          borderRadius: 16,
          borderCurve: 'continuous',
          paddingVertical: 22,
          paddingHorizontal: 20,
          alignItems: 'center',
          gap: 4,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <LockKeyhole size={14} color={c.primary} strokeWidth={2.5} />
          <Text
            style={{
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: c.primary,
            }}>
            Fixed price
          </Text>
        </View>
        <Text
          selectable
          style={{ color: c.text, fontVariant: ['tabular-nums'], letterSpacing: -1 }}>
          <Text style={{ fontSize: 52, fontWeight: '800' }}>{pounds}</Text>
          <Text style={{ fontSize: 30, fontWeight: '800' }}>.{pence}</Text>
        </Text>
        <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.textSecondary }}>
          {caption ?? "inc. VAT · no call-out fee · this is what you'll pay"}
        </Text>
      </View>
    );
  }

  if (variant === 'superseded') {
    return (
      <Text
        style={{
          fontSize: 15,
          fontWeight: '600',
          color: c.textTertiary,
          textDecorationLine: 'line-through',
          fontVariant: ['tabular-nums'],
        }}>
        {formatGBP(amount)}
      </Text>
    );
  }

  return (
    <Text
      selectable
      style={{ fontSize: 17, fontWeight: '700', color: c.text, fontVariant: ['tabular-nums'] }}>
      {formatGBP(amount)}
      {caption ? (
        <Text style={{ fontSize: 12, fontWeight: '600', color: c.textTertiary }}> {caption}</Text>
      ) : null}
    </Text>
  );
}
