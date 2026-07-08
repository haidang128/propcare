import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { usePalette } from '@/hooks/use-palette';

const STAR_GOLD = '#E8A33D';

/** 1–5 star input, 44×44 targets (design system component). */
export function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange?: (stars: number) => void;
  disabled?: boolean;
}) {
  const { colors: c } = usePalette();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          disabled={disabled || !onChange}
          onPress={() => onChange?.(star)}
          hitSlop={4}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 32, color: star <= value ? STAR_GOLD : c.border, lineHeight: 38 }}>
            ★
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
