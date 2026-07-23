import { Redirect } from 'expo-router';
import { Stack } from 'expo-router/stack';
import React from 'react';

import { HeaderSignOut } from '@/components/header-sign-out';
import { useAuth } from '@/lib/auth';

export default function TechnicianLayout() {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (!role) return <Redirect href="/sign-in" />;
  return (
    // headerRight on the layout, so every screen in the group carries it
    <Stack screenOptions={{ headerRight: () => <HeaderSignOut /> }}>
      <Stack.Screen name="index" options={{ title: 'Today', headerLargeTitle: true }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="job/[id]" options={{ title: 'Job' }} />
      <Stack.Screen
        name="flag/[jobId]"
        options={{
          title: 'Flag extra work',
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: [1.0],
        }}
      />
    </Stack>
  );
}
