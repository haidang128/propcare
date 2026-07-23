import { Redirect } from 'expo-router';
import { Stack } from 'expo-router/stack';
import React from 'react';

import { HeaderSignOut } from '@/components/header-sign-out';
import { useAuth } from '@/lib/auth';

export default function AdminLayout() {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (!role) return <Redirect href="/sign-in" />;
  return (
    // Sign-out sits on the layout so it is on every screen in the group: a
    // landlord who deep-links or refreshes onto a sub-screen has no back stack,
    // and had no way out of the app at all.
    <Stack screenOptions={{ headerRight: () => <HeaderSignOut /> }}>
      <Stack.Screen name="index" options={{ title: 'Dispatch', headerLargeTitle: true }} />
      <Stack.Screen name="variations" options={{ title: 'Variations' }} />
      <Stack.Screen name="variation/[id]" options={{ title: 'Review variation' }} />
      <Stack.Screen name="technicians" options={{ title: 'Technicians' }} />
      <Stack.Screen name="metrics" options={{ title: '90-day gate' }} />
      <Stack.Screen
        name="assign/[jobId]"
        options={{
          title: 'Assign technician',
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.6, 1.0],
        }}
      />
    </Stack>
  );
}
