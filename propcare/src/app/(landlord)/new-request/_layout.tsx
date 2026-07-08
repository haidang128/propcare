import { Stack } from 'expo-router/stack';
import React from 'react';

import { DraftProvider } from '@/lib/new-request-draft';

export default function NewRequestLayout() {
  return (
    <DraftProvider>
      <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="index" options={{ title: 'New request' }} />
        <Stack.Screen name="category" options={{ title: 'What kind of job?' }} />
        <Stack.Screen name="describe" options={{ title: "What's the problem?" }} />
        <Stack.Screen name="urgency" options={{ title: 'How urgent is it?' }} />
        <Stack.Screen name="price" options={{ title: 'Your fixed price' }} />
        <Stack.Screen name="booked" options={{ title: 'Booked', headerBackVisible: false, gestureEnabled: false }} />
      </Stack>
    </DraftProvider>
  );
}
