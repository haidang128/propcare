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
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: 'Dispatch', headerLargeTitle: true, headerRight: () => <HeaderSignOut /> }}
      />
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
