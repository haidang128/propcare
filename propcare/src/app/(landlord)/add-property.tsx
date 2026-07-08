import { router } from 'expo-router';
import { Info } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { addProperty } from '@/lib/data';

/** Add property — address + tenant contact for access (design 03 screen B). */
export default function AddProperty() {
  const { colors: c } = usePalette();
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [postcode, setPostcode] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const valid = addressLine1.trim().length > 3 && postcode.trim().length >= 5;

  async function save() {
    setSaving(true);
    try {
      await addProperty({
        address_line1: addressLine1.trim(),
        address_line2: addressLine2.trim() || null,
        city: 'London',
        postcode: postcode.trim().toUpperCase(),
        tenant_name: tenantName.trim() || null,
        tenant_phone: tenantPhone.trim() || null,
      });
      router.back();
    } catch (e) {
      Alert.alert('Could not save property', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    backgroundColor: c.backgroundElement,
    borderWidth: 1.5,
    borderColor: c.inputBorder,
    borderRadius: Radius.button,
    borderCurve: 'continuous' as const,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 15,
    color: c.text,
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1 }}>
      <Text style={{ fontSize: 15, color: c.textSecondary }}>You can add more any time.</Text>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: c.textSecondary }}>Address</Text>
        <TextInput
          value={addressLine1}
          onChangeText={setAddressLine1}
          placeholder="First line — e.g. Flat 2, 14 Berwick Street"
          placeholderTextColor={c.textTertiary}
          style={inputStyle}
        />
        <TextInput
          value={addressLine2}
          onChangeText={setAddressLine2}
          placeholder="Area (optional) — e.g. Soho"
          placeholderTextColor={c.textTertiary}
          style={inputStyle}
        />
        <TextInput
          value={postcode}
          onChangeText={setPostcode}
          placeholder="Postcode — e.g. W1F 0PP"
          placeholderTextColor={c.textTertiary}
          autoCapitalize="characters"
          style={inputStyle}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: c.textSecondary }}>
          Tenant contact — for access only
        </Text>
        <TextInput
          value={tenantName}
          onChangeText={setTenantName}
          placeholder="Tenant name"
          placeholderTextColor={c.textTertiary}
          style={inputStyle}
        />
        <TextInput
          value={tenantPhone}
          onChangeText={setTenantPhone}
          placeholder="Mobile number"
          placeholderTextColor={c.textTertiary}
          keyboardType="phone-pad"
          style={inputStyle}
        />
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 2 }}>
          <Info size={15} color={c.textTertiary} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, fontSize: 12.5, color: c.textTertiary, lineHeight: 19 }}>
            We only text your tenant to arrange access for jobs you book. They never see prices
            and don&apos;t need the app.
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 'auto' }}>
        <PrimaryButton label="Add property" disabled={!valid} loading={saving} onPress={save} />
      </View>
    </ScrollView>
  );
}
