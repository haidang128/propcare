import { Stack } from 'expo-router/stack';
import React from 'react';

export default function TechnicianLayout() {
  return (
    <Stack>
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
