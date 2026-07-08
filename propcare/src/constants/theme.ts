/**
 * PropCare design tokens — source of truth is `Design app/01 Design System.dc.html`.
 * One typeface (Public Sans), Harbour Blue primary, cool-neutral greys,
 * five status hues with one meaning each. WCAG AA; 44pt minimum touch targets.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#17222E', // Ink
    textSecondary: '#56646F',
    textTertiary: '#8A96A1',
    background: '#F4F6F8',
    backgroundElement: '#FFFFFF', // surface / card
    backgroundSelected: '#E9F0F7', // primary tint
    border: '#E2E7EC',
    inputBorder: '#C7CED4',
    primary: '#0F4C81', // Harbour Blue
    primaryPressed: '#0C3F6B',
    primaryTint: '#E9F0F7',
    primaryTintBorder: '#C6D8E8',
    onPrimary: '#FFFFFF',
  },
  dark: {
    text: '#EDF1F5',
    textSecondary: '#9AA7B2',
    textTertiary: '#75828E',
    background: '#10161D',
    backgroundElement: '#1A222B',
    backgroundSelected: '#16293C',
    border: '#2A3540',
    inputBorder: '#3A4653',
    primary: '#7FB2E0', // primary on dark
    primaryPressed: '#9CC4E8',
    primaryTint: '#16293C',
    primaryTintBorder: '#24425F',
    onPrimary: '#0C2036',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Status language: five hues, one meaning each. Amber always means
 * "you need to act". Chips are tinted, never filled.
 */
export const StatusColors = {
  light: {
    neutral: { bg: '#EEF1F4', fg: '#4A5560', dot: '#4A5560' }, // requested
    amber: { bg: '#FCF2DE', fg: '#7A5600', dot: '#B98200' }, // priced, variation pending — action needed
    blue: { bg: '#E9F0F7', fg: '#0F4C81', dot: '#0F4C81' }, // approved, scheduled — in hand
    green: { bg: '#E6F4EB', fg: '#1C7A43', dot: '#1C7A43' }, // live + completed + paid
    purple: { bg: '#F0EBFA', fg: '#6741B2', dot: '#6741B2' }, // paused, rescheduled
    red: { bg: '#FBEBEA', fg: '#B3261E', dot: '#B3261E' }, // cancelled, declined, no-show, disputed
  },
  dark: {
    neutral: { bg: '#232C36', fg: '#9AA7B2', dot: '#9AA7B2' },
    amber: { bg: '#3A2E14', fg: '#E8C36B', dot: '#E8C36B' },
    blue: { bg: '#16293C', fg: '#9CC4E8', dot: '#9CC4E8' },
    green: { bg: '#14311F', fg: '#7FD1A0', dot: '#7FD1A0' },
    purple: { bg: '#2A2140', fg: '#B9A1E8', dot: '#B9A1E8' },
    red: { bg: '#3B1B19', fg: '#F0928C', dot: '#F0928C' },
  },
} as const;

export type StatusHue = keyof typeof StatusColors.light;

export const Fonts = Platform.select({
  default: {
    sans: 'PublicSans_400Regular',
    medium: 'PublicSans_500Medium',
    semiBold: 'PublicSans_600SemiBold',
    bold: 'PublicSans_700Bold',
    extraBold: 'PublicSans_800ExtraBold',
    mono: 'ui-monospace',
  },
  web: {
    sans: "'Public Sans', system-ui, sans-serif",
    medium: "'Public Sans', system-ui, sans-serif",
    semiBold: "'Public Sans', system-ui, sans-serif",
    bold: "'Public Sans', system-ui, sans-serif",
    extraBold: "'Public Sans', system-ui, sans-serif",
    mono: 'ui-monospace, monospace',
  },
});

/** Type scale from the design system. Prices always tabular-nums. */
export const TypeScale = {
  hero: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  screenTitle: { fontSize: 24, fontWeight: '700', letterSpacing: -0.25 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  meta: { fontSize: 13, fontWeight: '600' },
  overline: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
} as const;

/** 4px scale: 4 / 8 / 12 / 16 / 24 / 32 */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
} as const;

/** Cards 12 · buttons 10 · chips pill · sheets 20 top */
export const Radius = {
  card: 12,
  button: 10,
  chip: 999,
  sheet: 20,
} as const;

/** Buttons min 48; list rows min 56 (44pt targets); technician surface goes bigger. */
export const TouchTarget = {
  button: 48,
  listRow: 56,
  technicianButton: 56,
} as const;

export const FloatingShadow = '0 8px 24px rgba(23,34,46,0.12)';

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
