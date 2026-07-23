import { Link, useFocusEffect } from 'expo-router';
import { BadgeCheck } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { listAllVariations, needsOfficeResolution, type Variation } from '@/lib/data';
import { formatGBP } from '@/lib/job-status';

type Hue = { bg: string; fg: string; dot: string };

function Section({
  title,
  blurb,
  items,
  hue,
  actionable,
}: {
  title: string;
  blurb: string;
  items: Variation[];
  hue: Hue;
  actionable: boolean;
}) {
  const { colors: c } = usePalette();
  if (items.length === 0) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 13.5, fontWeight: '800', color: hue.fg }}>
        {title} — {items.length}
      </Text>
      <Text style={{ fontSize: 12.5, color: c.textSecondary, lineHeight: 18 }}>{blurb}</Text>
      {items.map((v) => {
        const card = (
          <View
            style={{
              backgroundColor: c.backgroundElement,
              borderWidth: actionable ? 2 : 1,
              borderColor: actionable ? hue.dot : c.border,
              borderRadius: Radius.card,
              borderCurve: 'continuous',
              padding: 14,
              gap: 4,
            }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: c.text }} numberOfLines={2}>
                {v.note}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: hue.fg }}>
                {new Date(v.created_at).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: '2-digit',
                })}
              </Text>
            </View>
            <Text style={{ fontSize: 12.5, color: c.textSecondary }} numberOfLines={1}>
              {v.job?.job_type?.name ?? ''} · {v.job?.property?.address_line1 ?? ''} ·{' '}
              {v.job?.reference ?? ''}
            </Text>
            <Text style={{ fontSize: 12.5, color: c.textTertiary }}>
              Original {formatGBP(v.old_job_price_inc_vat)}
              {v.admin_price_inc_vat != null ? ` · extra ${formatGBP(v.admin_price_inc_vat)}` : ''}
              {v.new_job_price_inc_vat != null ? ` · now ${formatGBP(v.new_job_price_inc_vat)}` : ''}
            </Text>
          </View>
        );
        return actionable ? (
          <Link key={v.id} href={{ pathname: '/(admin)/variation/[id]', params: { id: v.id } }} asChild>
            <Pressable>{card}</Pressable>
          </Link>
        ) : (
          <View key={v.id}>{card}</View>
        );
      })}
    </View>
  );
}

/**
 * Variation review queue — amber = money decisions (design A2 list pane).
 *
 * This screen used to show only what the office had to price, which meant a
 * brand-new pilot saw an unexplained empty box, and anything already sent to a
 * landlord vanished from every screen until they answered.
 */
export default function VariationQueue() {
  const { colors: c, status } = usePalette();
  const [variations, setVariations] = useState<Variation[] | null>(null);

  const load = useCallback(async () => {
    try {
      setVariations(await listAllVariations());
    } catch {
      setVariations([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const all = variations ?? [];
  // declined-and-stuck first: those have a technician waiting on site
  const declined = all.filter(needsOfficeResolution);
  const toPrice = all.filter((v) => v.status === 'flagged' || v.status === 'admin_review');
  const withLandlord = all.filter((v) => v.status === 'pending_landlord');
  const settled = all.filter(
    (v) => !declined.includes(v) && !toPrice.includes(v) && !withLandlord.includes(v),
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{
        padding: 20,
        gap: 16,
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
      }}>
      <Text style={{ fontSize: 13, color: c.textSecondary, lineHeight: 19 }}>
        A variation is extra work a technician finds once they are on site — something the fixed
        price never covered. The job pauses, you price the extra, and the landlord approves it
        before any more work happens. That is the whole &quot;no surprise bills&quot; promise, so
        nothing here is charged until they say yes.
      </Text>

      <Section
        title="Landlord declined — job paused, waiting on you"
        blurb="Nothing is charged while these sit here, but the technician cannot carry on until you resume the original job or cancel it."
        items={declined}
        hue={status.red}
        actionable
      />
      <Section
        title="Needs a price"
        blurb="Flagged from site. Price the extra work and send it to the landlord."
        items={toPrice}
        hue={status.amber}
        actionable
      />
      <Section
        title="With the landlord"
        blurb="Priced and sent. The job stays paused until they answer — chase them if a technician is waiting."
        items={withLandlord}
        hue={status.blue}
        actionable={false}
      />
      <Section
        title="Settled"
        blurb="Approved, rejected, or resolved. Kept for the record."
        items={settled}
        hue={status.green}
        actionable={false}
      />

      {variations !== null && all.length === 0 ? (
        <View
          style={{
            backgroundColor: c.backgroundElement,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 14,
            borderCurve: 'continuous',
            paddingVertical: 36,
            paddingHorizontal: 20,
            alignItems: 'center',
            gap: 10,
          }}>
          <BadgeCheck size={28} color={c.textTertiary} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>
            No extra work has been flagged
          </Text>
          <Text style={{ fontSize: 13, color: c.textSecondary, textAlign: 'center', lineHeight: 19 }}>
            That is the good outcome — every job so far has been done for the price the landlord
            agreed. Anything a technician flags from site lands here first.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
