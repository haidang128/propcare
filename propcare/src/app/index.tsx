import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/lib/auth';

/** "/" routes by role: landlord, technician, and admin each get their own surface. */
export default function Index() {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!role) return <Redirect href="/sign-in" />;
  if (role === 'technician') return <Redirect href="/(technician)" />;
  if (role === 'admin') return <Redirect href="/(admin)" />;
  return <Redirect href="/(landlord)" />;
}
