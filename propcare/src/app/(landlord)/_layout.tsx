import { Stack } from 'expo-router/stack';
import React from 'react';

import { HeaderSignOut } from '@/components/header-sign-out';

export default function LandlordLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: 'PropCare', headerLargeTitle: true, headerRight: () => <HeaderSignOut /> }}
      />
      <Stack.Screen name="add-property" options={{ title: 'Add a property' }} />
      {/* the wizard renders its own stack + headers */}
      <Stack.Screen name="new-request" options={{ headerShown: false }} />
      <Stack.Screen name="job/[id]" options={{ title: 'Job' }} />
      <Stack.Screen name="variation/[jobId]" options={{ title: 'Extra work needs your OK' }} />
      <Stack.Screen name="complete/[id]" options={{ title: 'Completion & payment' }} />
      <Stack.Screen name="property/[id]" options={{ title: 'Property' }} />
      <Stack.Screen name="fallback/[id]" options={{ title: 'Emergency help' }} />
    </Stack>
  );
}
