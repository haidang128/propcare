import React from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
};

export function PrimaryButton({ label, onPress, variant = 'primary', disabled, loading }: Props) {
  const { colors: c } = usePalette();
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        backgroundColor: isPrimary
          ? pressed
            ? c.primaryPressed
            : c.primary
          : c.backgroundElement,
        borderWidth: isPrimary ? 0 : 1.5,
        borderColor: c.primary,
        opacity: disabled ? 0.5 : 1,
        minHeight: 52,
        borderRadius: Radius.card,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
      })}>
      {loading ? (
        <ActivityIndicator color={isPrimary ? c.onPrimary : c.primary} />
      ) : (
        <Text
          style={{
            color: isPrimary ? c.onPrimary : c.primary,
            fontSize: 16,
            fontWeight: '700',
          }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
