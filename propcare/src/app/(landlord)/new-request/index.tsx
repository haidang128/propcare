import { router, Stack } from 'expo-router';
import { Home } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { StepBadge } from '@/components/step-badge';
import { Radius, TouchTarget } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { listProperties, type Property } from '@/lib/data';
import { useDraft } from '@/lib/new-request-draft';

/** Step 1 of 5 — which property needs attention? (design 02, screen 1) */
export default function PickProperty() {
  const { colors: c } = usePalette();
  const draft = useDraft();
  const [properties, setProperties] = useState<Property[] | null>(null);

  useEffect(() => {
    listProperties().then(setProperties).catch(() => setProperties([]));
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <StepBadge label="Step 1 of 5" /> }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1 }}>
        <Text style={{ fontSize: 15, color: c.textSecondary }}>
          Which property needs attention?
        </Text>

        <View style={{ gap: 10 }}>
          {(properties ?? []).map((p) => {
            const selected = draft.property?.id === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => draft.update({ property: p })}
                style={{
                  backgroundColor: c.backgroundElement,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? c.primary : c.border,
                  borderRadius: Radius.card,
                  borderCurve: 'continuous',
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  minHeight: TouchTarget.listRow,
                }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    borderCurve: 'continuous',
                    backgroundColor: selected ? c.primaryTint : c.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Home size={22} color={selected ? c.primary : c.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>
                    {p.address_line1}
                  </Text>
                  <Text style={{ fontSize: 13, color: c.textSecondary }}>
                    {[p.address_line2, p.city, p.postcode].filter(Boolean).join(', ')}
                    {p.tenant_name ? ` · Tenant: ${p.tenant_name}` : ''}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => router.push('/(landlord)/add-property')}
            style={{
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: c.inputBorder,
              borderRadius: Radius.card,
              borderCurve: 'continuous',
              padding: 14,
              alignItems: 'center',
              minHeight: TouchTarget.button,
              justifyContent: 'center',
            }}>
            <Text style={{ color: c.primary, fontSize: 15, fontWeight: '700' }}>
              ＋ Add a property
            </Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 'auto' }}>
          <PrimaryButton
            label="Continue"
            disabled={!draft.property}
            onPress={() => router.push('/(landlord)/new-request/category')}
          />
        </View>
      </ScrollView>
    </>
  );
}
