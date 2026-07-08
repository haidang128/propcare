import React, { createContext, useMemo, useState } from 'react';

import type { Job, JobType, Property, Urgency } from '@/lib/data';

type Draft = {
  property: Property | null;
  jobType: JobType | null;
  description: string;
  photoUris: string[];
  urgency: Urgency;
  slot: { start: string; end: string; label: string; timeLabel: string } | null;
  /** set after successful booking so the confirmation screen can render */
  bookedJob: Job | null;
};

type DraftState = Draft & {
  update: (patch: Partial<Draft>) => void;
  reset: () => void;
};

const empty: Draft = {
  property: null,
  jobType: null,
  description: '',
  photoUris: [],
  urgency: 'standard',
  slot: null,
  bookedJob: null,
};

const DraftContext = createContext<DraftState | null>(null);

/** Wizard state for the new-request flow — lives in the (landlord)/new-request layout. */
export function DraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<Draft>(empty);

  const value = useMemo(
    () => ({
      ...draft,
      update: (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })),
      reset: () => setDraft(empty),
    }),
    [draft],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftState {
  const ctx = React.use(DraftContext);
  if (!ctx) throw new Error('useDraft must be used inside DraftProvider');
  return ctx;
}
