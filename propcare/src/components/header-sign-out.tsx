import { router } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import React from 'react';
import { Pressable, Text } from 'react-native';

import { usePalette } from '@/hooks/use-palette';
import { useAuth } from '@/lib/auth';

/** Header-right sign-out control for the landlord and admin home screens. */
export function HeaderSignOut() {
  const { colors: c } = usePalette();
  const { signOut } = useAuth();
  return (
    <Pressable
      hitSlop={10}
      onPress={() => {
        signOut();
        router.replace('/'); // role is now null → root redirects to /sign-in
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
      <LogOut size={17} color={c.primary} />
      <Text style={{ color: c.primary, fontSize: 15, fontWeight: '600' }}>Sign out</Text>
    </Pressable>
  );
}
