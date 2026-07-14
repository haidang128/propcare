import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { usePalette } from '@/hooks/use-palette';

const UPDATED = '14 July 2026';
const CONTACT_EMAIL = 'dangngochai@gmail.com';

/**
 * Public privacy policy — linked from the sign-in screen and used as the
 * privacy-policy URL for the app stores and the Google OAuth consent screen.
 * Plain static content; no auth, no data access.
 */
function H({ children }: { children: React.ReactNode }) {
  const { colors: c } = usePalette();
  return (
    <Text
      style={{
        color: c.text,
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.3,
        marginTop: 24,
      }}>
      {children}
    </Text>
  );
}

function P({ children }: { children: React.ReactNode }) {
  const { colors: c } = usePalette();
  return <Text style={{ color: c.textSecondary, fontSize: 15, lineHeight: 23 }}>{children}</Text>;
}

function B({ children }: { children: React.ReactNode }) {
  const { colors: c } = usePalette();
  return <Text style={{ color: c.text, fontWeight: '600' }}>{children}</Text>;
}

export default function Privacy() {
  const { colors: c } = usePalette();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 24, paddingBottom: 64 }}>
      <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center', gap: 12 }}>
        <Text
          style={{
            color: c.text,
            fontSize: 28,
            fontWeight: '800',
            letterSpacing: -0.5,
            marginTop: 24,
          }}>
          Privacy policy
        </Text>
        <P>PropCare — property maintenance for landlords. Last updated {UPDATED}.</P>

        <H>Who we are</H>
        <P>
          PropCare provides a maintenance booking service for residential landlords in London. We
          are the data controller for the personal information described below. Questions or
          requests: <B>{CONTACT_EMAIL}</B>.
        </P>

        <H>What we collect</H>
        <P>
          <B>Landlords</B> — your email address and sign-in identity (email magic link, Google or
          Apple), the addresses of properties you add, and the maintenance requests you raise
          (descriptions, photos, chosen appointment times, invoices and payment status).
        </P>
        <P>
          <B>Technicians</B> — your email address, name, trade certifications and their expiry
          dates, on-call status, pay rate, and job activity including before/after photos, notes,
          and time and materials records.
        </P>
        <P>
          <B>Tenants</B> — the name and phone number your landlord gives us so a technician can
          arrange access, and the appointment slot you choose through the visit link we send you.
          Tenants do not need an account, and the visit link expires after use.
        </P>
        <P>
          We also store push-notification tokens for devices that opt in, and standard technical
          logs (IP address, browser type) kept by our hosting providers for security.
        </P>

        <H>How we use it</H>
        <P>
          To operate the service you or your landlord asked for: booking jobs, dispatching
          technicians, arranging property access, invoicing and taking payment, and notifying the
          people involved about job progress (performance of a contract). To keep financial records
          the law requires us to keep (legal obligation). To monitor service quality and safety,
          such as certification checks on technicians (legitimate interests). We do not sell
          personal data and we do not use it for advertising.
        </P>

        <H>Who we share it with</H>
        <P>
          <B>Supabase</B> hosts our database in London (AWS eu-west-2). <B>Stripe</B> processes
          payments — card details go directly to Stripe and never touch our systems. <B>Expo</B>{' '}
          hosts the web app and delivers push notifications. <B>Google</B> and <B>Apple</B> handle
          sign-in if you choose those options. If SMS notifications are enabled, <B>Twilio</B>{' '}
          delivers them. Technicians see the property address, access details and job information
          they need to do the work. We share data with authorities only where the law requires it.
        </P>

        <H>How long we keep it</H>
        <P>
          Maintenance and invoice records are kept for six years after the end of the tax year they
          relate to, as required for tax purposes — this is also what makes your property&apos;s
          maintenance history exportable for your own records. Tenant contact details are kept only
          while needed to arrange access. You can ask us to delete your account and anything not
          covered by a legal retention duty.
        </P>

        <H>Your rights</H>
        <P>
          Under UK GDPR you can ask for a copy of your data, ask us to correct or delete it,
          object to or restrict processing, and take your data elsewhere. Email{' '}
          <B>{CONTACT_EMAIL}</B> and we will respond within one month. If you are unhappy with how
          we handle your data you can complain to the Information Commissioner&apos;s Office
          (ico.org.uk).
        </P>

        <H>Cookies and local storage</H>
        <P>
          We use local storage only to keep you signed in. There are no advertising or analytics
          cookies.
        </P>

        <H>Changes</H>
        <P>
          We will update this page when our practices change and revise the date at the top.
          Significant changes will be flagged in the app.
        </P>
      </View>
    </ScrollView>
  );
}
