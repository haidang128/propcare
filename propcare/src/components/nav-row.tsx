import { Link, type Href } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';

export type NavItem = { href: Href; label: string; icon: LucideIcon };

/**
 * In-body section navigation: tinted pill links that wrap. Lives in the page
 * rather than `headerRight` because a header row of three or more controls
 * overflows the viewport on a phone and silently clips the last one.
 */
export function NavRow({ items }: { items: NavItem[] }) {
  const { colors: c } = usePalette();
  return (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {items.map(({ href, label, icon: Icon }) => (
        <Link key={label} href={href} asChild>
          {/* object style, not the function form — the latter renders invisible
              on react-native-web under `Link asChild` */}
          <Pressable
            accessibilityRole="link"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              minHeight: 40,
              paddingHorizontal: 14,
              backgroundColor: c.primaryTint,
              borderWidth: 1,
              borderColor: c.primaryTintBorder,
              borderRadius: Radius.chip,
              borderCurve: 'continuous',
            }}>
            <Icon size={16} color={c.primary} />
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: c.primary }}>{label}</Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}
