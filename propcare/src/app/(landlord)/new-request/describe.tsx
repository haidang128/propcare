import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Camera } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { StepBadge } from '@/components/step-badge';
import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { jobPrice, listJobTypes, maxUnits, type Category, type JobType } from '@/lib/data';
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

  // On web the URL is real: a refresh or a bookmark can land here with an empty
  // draft, leaving a step with no property and no job types to choose from.
  if (!draft.property || !category) return <Redirect href="/(landlord)/new-request" />;

  const selected = draft.jobType;

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
                  onPress={() => draft.update({ jobType: t, quantity: 1 })}
                  style={{
                    backgroundColor: isSelected ? c.primary : c.backgroundElement,
                    borderWidth: isSelected ? 0 : t.requires_quote ? 1.5 : 1,
                    borderColor: t.requires_quote ? c.primary : c.border,
                    borderStyle: t.requires_quote && !isSelected ? 'dashed' : 'solid',
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
                    {t.requires_quote
                      ? t.name
                      : `${t.name} · ${formatGBP(t.price_inc_vat).replace('.00', '')}${
                          t.unit === 'hour' ? '/hr' : ''
                        }`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {/* The rate card is 23 lines; the things that break in a flat are not.
              Without this, anything unlisted has no way into the app at all. */}
          {selected?.requires_quote ? (
            <Text style={{ fontSize: 12.5, color: c.textSecondary, lineHeight: 18 }}>
              Tell us what&apos;s wrong below and add a photo. We&apos;ll come back with a fixed
              price to approve — nothing is booked and nothing is charged until you do.
            </Text>
          ) : null}
        </View>

        {/* Hourly lines are sold by the hour (rate card H1, E5); one hour was
            the only quantity the app could express. */}
        {selected && selected.unit === 'hour' && !selected.requires_quote ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: c.textSecondary }}>
              How long do you think it needs?
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Array.from({ length: maxUnits(selected) }, (_, i) => i + 1).map((hours) => {
                const on = draft.quantity === hours;
                return (
                  <Pressable
                    key={hours}
                    onPress={() => draft.update({ quantity: hours })}
                    style={{
                      backgroundColor: on ? c.primary : c.backgroundElement,
                      borderWidth: on ? 0 : 1,
                      borderColor: c.border,
                      minWidth: 74,
                      minHeight: 44,
                      paddingHorizontal: 12,
                      borderRadius: Radius.chip,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: on ? c.onPrimary : c.text }}>
                      {hours} hour{hours > 1 ? 's' : ''}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11.5,
                        color: on ? c.onPrimary : c.textTertiary,
                        fontVariant: ['tabular-nums'],
                      }}>
                      {formatGBP(jobPrice(selected, 'standard', hours) ?? 0).replace('.00', '')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {/* The first hour carries the call-out, so later hours are cheaper.
                Say so — otherwise the totals look like arbitrary arithmetic. */}
            {selected.additional_unit_price_inc_vat != null &&
            selected.additional_unit_price_inc_vat < selected.price_inc_vat ? (
              <Text style={{ fontSize: 12, color: c.textTertiary, lineHeight: 17 }}>
                {formatGBP(selected.price_inc_vat).replace('.00', '')} for the first hour — it
                covers getting an engineer to you — then{' '}
                {formatGBP(selected.additional_unit_price_inc_vat).replace('.00', '')} an hour after
                that.
              </Text>
            ) : null}
            <Text style={{ fontSize: 12, color: c.textTertiary, lineHeight: 17 }}>
              Pick the hours up front and that&apos;s the fixed price. If it turns out to need
              longer, the engineer asks you first — you&apos;re never billed for time you
              didn&apos;t agree.
            </Text>
          </View>
        ) : null}

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
            // nothing can be quoted from a blank description
            disabled={!selected || (selected.requires_quote && draft.description.trim().length < 10)}
            onPress={() => router.push('/(landlord)/new-request/urgency')}
          />
          {selected?.requires_quote && draft.description.trim().length < 10 ? (
            <Text style={{ fontSize: 12, color: c.textTertiary, textAlign: 'center', marginTop: 6 }}>
              Describe the job above so we can price it.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}
