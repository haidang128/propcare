import { Stack } from 'expo-router/stack';
import React from 'react';

import { HeaderSignOut } from '@/components/header-sign-out';

export default function AdminLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: 'Dispatch', headerLargeTitle: true, headerRight: () => <HeaderSignOut /> }}
      />
      <Stack.Screen name="variations" options={{ title: 'Variations' }} />
      <Stack.Screen name="variation/[id]" options={{ title: 'Review variation' }} />
      <Stack.Screen name="technicians" options={{ title: 'Technicians' }} />
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
