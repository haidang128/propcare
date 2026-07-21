import React from 'react';
import { Platform, View } from 'react-native';

/**
 * Wrapper for `headerRight` controls. react-navigation's web header gives
 * headerRight no right inset, so controls end up flush against the viewport
 * edge (and the last one gets clipped). Native already insets correctly.
 */
export function HeaderRight({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingRight: Platform.OS === 'web' ? 16 : 0,
      }}>
      {children}
    </View>
  );
}
