import { router, useLocalSearchParams } from 'expo-router';
import { LockKeyhole, ShieldCheck } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';

import { showDialog } from '@/components/dialog';
import { PrimaryButton } from '@/components/primary-button';
import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import {
  assignJob,
  getJob,
  isEligible,
  listTechnicians,
  type Job,
  type Technician,
} from '@/lib/data';

/**
 * Assign technician — certification blocking is visible in the UI and
 * enforced again by the DB trigger (defence in depth, design A1 popover).
 */
export default function AssignSheet() {
  const { colors: c, status } = usePalette();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getJob(jobId).then(setJob);
    listTechnicians().then(setTechnicians).catch(() => {});
  }, [jobId]);

  async function confirm() {
    if (!job || !selected) return;
    setSaving(true);
    try {
      const tenantLink = await assignJob(job, selected);
      if (tenantLink && job.property?.tenant_name) {
        // SMS automation lands with Twilio; until then the dispatcher sends it
        showDialog(
          'Assigned — send the access link',
          `Text ${job.property.tenant_name} this link so they can pick a time:\n\n${tenantLink}`,
          [
            { text: 'Share…', onPress: () => Share.share({ message: tenantLink }) },
            { text: 'Done', onPress: () => router.back() },
          ],
        );
      } else {
        router.back();
      }
    } catch (e) {
      showDialog('Assignment failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const selectedTech = technicians.find((t) => t.id === selected);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 20, gap: 12, flexGrow: 1 }}>
      {job ? (
        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>
            {job.job_type?.name} · {job.reference}
          </Text>
          {job.category === 'electrical' ? (
            <Text style={{ fontSize: 12.5, color: c.textTertiary }}>
              Only certified electricians can take this job.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        {technicians.map((tech) => {
          const eligible = job ? isEligible(tech, job.category) : true;
          const isSelected = selected === tech.id;
          const cert = tech.certifications.find(
            (x) => (x.type === 'niceic' || x.type === 'napit') && x.verified,
          );
          return (
            <Pressable
              key={tech.id}
              disabled={!eligible}
              onPress={() => setSelected(tech.id)}
              style={{
                backgroundColor: eligible ? c.backgroundElement : c.background,
                borderWidth: isSelected ? 2 : 1.5,
                borderColor: isSelected ? c.primary : c.border,
                borderRadius: Radius.button,
                borderCurve: 'continuous',
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                minHeight: 56,
                opacity: eligible ? 1 : 0.75,
              }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14.5,
                    fontWeight: '700',
                    color: eligible ? c.text : c.textTertiary,
                  }}>
                  {tech.full_name}
                </Text>
                {eligible ? (
                  cert ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <ShieldCheck size={12} color={status.green.fg} />
                      <Text style={{ fontSize: 11.5, fontWeight: '700', color: status.green.fg }}>
                        {cert.type.toUpperCase()} · valid to{' '}
                        {new Date(cert.expires_on).toLocaleDateString('en-GB')}
                      </Text>
                    </View>
                  ) : null
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <LockKeyhole size={12} color={status.red.fg} />
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: status.red.fg }}>
                      Blocked — no valid electrical certification
                    </Text>
                  </View>
                )}
              </View>
              {isSelected ? (
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: c.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text style={{ color: c.onPrimary, fontSize: 11, fontWeight: '800' }}>✓</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
        {technicians.length === 0 ? (
          <Text style={{ fontSize: 13.5, color: c.textSecondary, textAlign: 'center', padding: 16 }}>
            No technicians yet — set a user&apos;s role to &quot;technician&quot; in the profiles
            table to see them here.
          </Text>
        ) : null}
      </View>

      <View style={{ marginTop: 'auto' }}>
        <PrimaryButton
          label={selectedTech ? `Assign to ${selectedTech.full_name.split(' ')[0]}` : 'Assign'}
          disabled={!selected}
          loading={saving}
          onPress={confirm}
        />
      </View>
    </ScrollView>
  );
}
