import { Stack, useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Download } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';

import { showDialog } from '@/components/dialog';
import { HeaderRight } from '@/components/header-right';
import { Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { getProperty, listPropertyHistory, type Category, type HistoryEntry, type Property } from '@/lib/data';
import { downloadTextFile } from '@/lib/share';
import { formatGBP, statusLabel } from '@/lib/job-status';
import { incVatCaption } from '@/lib/pricing';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB');

/** UK tax year starts 6 April. */
function taxYearStart(): Date {
  const now = new Date();
  const start = new Date(now.getFullYear(), 3, 6);
  return now < start ? new Date(now.getFullYear() - 1, 3, 6) : start;
}

function csvFor(property: Property, entries: HistoryEntry[]): string {
  const rows = [
    ['Date', 'Job', 'Category', 'Reference', 'Status', `Total${incVatCaption() ? ' (inc VAT)' : ''}`, 'Invoice status'],
    ...entries.map((e) => [
      fmtDate(e.created_at),
      e.job_type?.name ?? e.description.slice(0, 40),
      e.category,
      e.reference,
      e.status,
      String(e.agreed_price_inc_vat ?? ''),
      e.invoice?.status ?? '',
    ]),
  ];
  return rows.map((r) => r.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
}

function pdfHtmlFor(property: Property, entries: HistoryEntry[]): string {
  const rows = entries
    .map(
      (e) => `<tr>
        <td>${fmtDate(e.created_at)}</td><td>${e.job_type?.name ?? e.description.slice(0, 40)}</td>
        <td>${e.reference}</td><td>${e.status}</td>
        <td style="text-align:right">${e.agreed_price_inc_vat != null ? formatGBP(e.agreed_price_inc_vat) : ''}</td>
      </tr>`,
    )
    .join('');
  return `
    <html><body style="font-family: -apple-system, sans-serif; padding: 32px; color: #17222E">
    <h1 style="font-size:20px; margin:0">PropCare — maintenance record</h1>
    <p style="color:#56646F; margin:4px 0 20px">${property.address_line1}, ${property.postcode} · generated ${fmtDate(new Date().toISOString())}</p>
    <table style="width:100%; border-collapse:collapse; font-size:12px">
      <tr style="text-align:left; color:#8A96A1"><th>Date</th><th>Job</th><th>Ref</th><th>Status</th><th style="text-align:right">Total${incVatCaption() ? ' inc. VAT' : ''}</th></tr>
      ${rows}
    </table>
    </body></html>`;
}

/** Property history — filterable record with PDF/CSV export (design 03 E). */
export default function PropertyHistory() {
  const { colors: c, status } = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState<Category | 'all'>('all');

  useEffect(() => {
    getProperty(id).then(setProperty);
    listPropertyHistory(id).then(setEntries).catch(() => {});
  }, [id]);

  const filtered = useMemo(
    () => entries.filter((e) => filter === 'all' || e.category === filter),
    [entries, filter],
  );

  const taxYearSpend = useMemo(() => {
    const start = taxYearStart();
    return entries
      .filter((e) => ['paid'].includes(e.status) && new Date(e.created_at) >= start)
      .reduce((sum, e) => sum + (e.agreed_price_inc_vat ?? 0), 0);
  }, [entries]);

  async function exportRecord() {
    if (!property) return;
    showDialog('Export maintenance record', 'Pick a format', [
      {
        text: 'PDF',
        onPress: async () => {
          try {
            const html = pdfHtmlFor(property, filtered);
            if (Platform.OS === 'web') {
              // web has no file system — open the print dialog (save-as-PDF)
              await Print.printAsync({ html });
            } else {
              const { uri } = await Print.printToFileAsync({ html });
              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
              }
            }
          } catch (e) {
            showDialog('Export failed', e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
      {
        text: 'CSV',
        onPress: () => {
          const csv = csvFor(property, filtered);
          if (Platform.OS === 'web') {
            downloadTextFile(`${property.address_line1}-maintenance.csv`, csv, 'text/csv;charset=utf-8');
          } else {
            Share.share({ message: csv });
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const counts = (cat: Category) => entries.filter((e) => e.category === cat).length;

  return (
    <>
      <Stack.Screen
        options={{
          title: property?.address_line1 ?? 'Property',
          headerRight: () => (
            <HeaderRight>
              <Pressable
                onPress={exportRecord}
                hitSlop={8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Download size={16} color={c.primary} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: c.primary }}>PDF / CSV</Text>
              </Pressable>
            </HeaderRight>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ padding: 20, gap: 14 }}>
        <Text style={{ fontSize: 13.5, color: c.textSecondary }}>
          Full maintenance record · handy for tax, insurance &amp; resale
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(
            [
              ['all', `All · ${entries.length}`],
              ['plumbing', `Plumbing · ${counts('plumbing')}`],
              ['electrical', `Electrical · ${counts('electrical')}`],
              ['handyman', `Handyman · ${counts('handyman')}`],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setFilter(key as Category | 'all')}
              style={{
                backgroundColor: filter === key ? c.primary : c.backgroundElement,
                borderWidth: filter === key ? 0 : 1,
                borderColor: c.border,
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: Radius.chip,
                minHeight: 40,
                justifyContent: 'center',
              }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: filter === key ? c.onPrimary : c.textSecondary }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View
          style={{
            backgroundColor: c.backgroundElement,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: Radius.card,
            borderCurve: 'continuous',
            paddingVertical: 12,
            paddingHorizontal: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}>
          <Text style={{ fontSize: 13, color: c.textSecondary }}>Spend this tax year (paid jobs)</Text>
          <Text selectable style={{ fontSize: 20, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'] }}>
            {formatGBP(taxYearSpend)}
          </Text>
        </View>

        <View style={{ gap: 9 }}>
          {filtered.map((e) => {
            const paid = e.invoice?.status === 'paid' || e.invoice?.status === 'auto_captured';
            const disputed = e.status === 'disputed';
            return (
              <View
                key={e.id}
                style={{
                  backgroundColor: c.backgroundElement,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: Radius.card,
                  borderCurve: 'continuous',
                  padding: 14,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: 10,
                }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }} numberOfLines={1}>
                    {e.job_type?.name ?? e.description.slice(0, 40)}
                  </Text>
                  <Text style={{ fontSize: 12, color: c.textTertiary }}>
                    {fmtDate(e.created_at)} · {e.reference}
                    {!paid && !disputed ? ` · ${statusLabel(e.status)}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                  {e.agreed_price_inc_vat != null ? (
                    <Text style={{ fontSize: 14, fontWeight: '700', color: c.text, fontVariant: ['tabular-nums'] }}>
                      {formatGBP(e.agreed_price_inc_vat)}
                    </Text>
                  ) : null}
                  {paid || disputed ? (
                    <View
                      style={{
                        backgroundColor: disputed ? status.red.bg : status.green.bg,
                        paddingVertical: 2,
                        paddingHorizontal: 8,
                        borderRadius: Radius.chip,
                      }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: disputed ? status.red.fg : status.green.fg }}>
                        {disputed ? 'Disputed' : 'Paid'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
          {filtered.length === 0 ? (
            <Text style={{ fontSize: 13.5, color: c.textSecondary, textAlign: 'center', padding: 20 }}>
              No jobs here yet.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}
