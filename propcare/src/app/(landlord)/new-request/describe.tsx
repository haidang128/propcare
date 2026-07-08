import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Camera } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { StepBadge } from '@/components/step-badge';
import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { listJobTypes, type Category, type JobType } from '@/lib/data';
import { formatGBP } from '@/lib/job-status';
import { useDraft } from '@/lib/new-request-draft';

/** Step 3 of 5 — pick the fixed-price job, describe it, add photos. */
export default function DescribeIssue() {
  const { colors: c } = usePalette();
  const draft = useDraft();
  const { category } = useLocalSearchParams<{ category: Category }>();
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);

  useEffect(() => {
    listJobTypes()
      .then((all) => setJobTypes(all.filter((t) => t.category === category)))
      .catch(() => {});
  }, [category]);

  async function addPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.7,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) {
      draft.update({ photoUris: [...draft.photoUris, result.assets[0].uri] });
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <StepBadge label="Step 3 of 5" /> }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1 }}>
        <Text style={{ fontSize: 15, color: c.textSecondary }}>
          {draft.property?.address_line1}
        </Text>

        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: c.textSecondary }}>
            Common jobs — fixed prices
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {jobTypes.map((t) => {
              const isSelected = draft.jobType?.id === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => draft.update({ jobType: t })}
                  style={{
                    backgroundColor: isSelected ? c.primary : c.backgroundElement,
                    borderWidth: isSelected ? 0 : 1,
                    borderColor: c.border,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: Radius.chip,
                    minHeight: 44,
                    justifyContent: 'center',
                  }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: isSelected ? c.onPrimary : c.text,
                      fontVariant: ['tabular-nums'],
                    }}>
                    {t.name} · {formatGBP(t.price_inc_vat).replace('.00', '')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <TextInput
          value={draft.description}
          onChangeText={(description) => draft.update({ description })}
          placeholder="Describe the issue — what's happening, and for how long?"
          placeholderTextColor={c.textTertiary}
          multiline
          style={{
            backgroundColor: c.backgroundElement,
            borderWidth: 1.5,
            borderColor: c.inputBorder,
            borderRadius: Radius.card,
            borderCurve: 'continuous',
            padding: 14,
            minHeight: 96,
            fontSize: 15,
            color: c.text,
            textAlignVertical: 'top',
          }}
        />

        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: c.textSecondary }}>
            Photos help the engineer arrive prepared
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {draft.photoUris.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={{ width: 86, height: 86, borderRadius: 10 }}
                contentFit="cover"
              />
            ))}
            <Pressable
              onPress={addPhoto}
              style={{
                width: 86,
                height: 86,
                borderRadius: 10,
                borderCurve: 'continuous',
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: c.inputBorder,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}>
              <Camera size={22} color={c.primary} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: c.primary }}>Add</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ marginTop: 'auto' }}>
          <PrimaryButton
            label="Continue"
            disabled={!draft.jobType}
            onPress={() => router.push('/(landlord)/new-request/urgency')}
          />
        </View>
      </ScrollView>
    </>
  );
}
