import { useColorScheme } from 'react-native';

import { Colors, StatusColors } from '@/constants/theme';

/** Normalised colour scheme + design tokens for the current appearance. */
export function usePalette() {
  const raw = useColorScheme();
  const scheme: 'light' | 'dark' = raw === 'dark' ? 'dark' : 'light';
  return { scheme, colors: Colors[scheme], status: StatusColors[scheme] };
}
