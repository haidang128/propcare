import {
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
  PublicSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/public-sans';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { usePalette } from '@/hooks/use-palette';
import { usePushRegistration } from '@/hooks/use-push-registration';
import { AuthProvider } from '@/lib/auth';

SplashScreen.preventAutoHideAsync();

function PushRegistrar() {
  usePushRegistration();
  return null;
}

export default function RootLayout() {
  const { scheme, colors: c } = usePalette();
  const [fontsLoaded] = useFonts({
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
    PublicSans_700Bold,
    PublicSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  const navTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...navTheme,
        colors: {
          ...navTheme.colors,
          primary: c.primary,
          background: c.background,
          card: c.backgroundElement,
          text: c.text,
          border: c.border,
        },
      }}>
      <AuthProvider>
        <PushRegistrar />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="(landlord)" />
          <Stack.Screen name="(technician)" />
          <Stack.Screen name="(admin)" />
          {/* public tenant page — token in the URL is the credential */}
          <Stack.Screen name="visit/[token]" />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
