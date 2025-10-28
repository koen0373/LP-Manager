'use client';

import React from 'react';

const ALLOWED_KEYS = ['WAITLIST_ENABLED', 'FASTFORWARD_ENABLED'] as const;
type SettingKey = (typeof ALLOWED_KEYS)[number];

type SettingsResponse = {
  WAITLIST_ENABLED: boolean;
  FASTFORWARD_ENABLED: boolean;
};

function parseSettings(payload: Record<string, string | undefined>): SettingsResponse {
  return {
    WAITLIST_ENABLED: (payload.WAITLIST_ENABLED ?? '0') === '1',
    FASTFORWARD_ENABLED: (payload.FASTFORWARD_ENABLED ?? '1') === '1',
  };
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = React.useState<SettingsResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savingKey, setSavingKey] = React.useState<SettingKey | null>(null);

  async function loadSettings() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/settings', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to load settings');
      const data = await response.json();
      setSettings(parseSettings(data.settings ?? {}));
    } catch (err) {
      console.error('[AdminSettings] load failed', err);
      setError('Unable to load settings.');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadSettings();
  }, []);

  async function toggleSetting(key: SettingKey, value: boolean) {
    try {
      setSavingKey(key);
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: value ? '1' : '0' }),
      });
      if (!response.ok) throw new Error('Failed to update setting');
      const data = await response.json();
      setSettings(parseSettings(data.settings ?? {}));
    } catch (err) {
      console.error('[AdminSettings] toggle failed', err);
      setError('Unable to update setting.');
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#05070C] px-6 py-12 text-white md:px-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-3xl border border-white/10 bg-[rgba(10,15,26,0.9)] px-6 py-8 backdrop-blur-xl">
          <h1 className="font-brand text-3xl font-semibold text-white">Admin settings</h1>
          <p className="mt-2 font-ui text-sm text-[#B0B9C7]">
            DEV ONLY — toggles control waitlist and fast-forward availability for the pricing UI. Changes apply instantly.
          </p>

          {loading && <p className="mt-6 font-ui text-sm text-[#B0B9C7]">Loading settings…</p>}
          {error && <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 font-ui text-sm text-red-200">{error}</p>}

          {settings && (
            <div className="mt-6 space-y-4 font-ui text-sm">
              {ALLOWED_KEYS.map((key) => {
                const checked = settings[key];
                return (
                  <div key={key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3">
                    <div>
                      <p className="font-medium text-white">{key === 'WAITLIST_ENABLED' ? 'Waitlist enabled' : 'Fast-forward enabled'}</p>
                      <p className="text-xs text-[#B0B9C7]">
                        {key === 'WAITLIST_ENABLED'
                          ? 'Allow users to join the priority list when seats are full.'
                          : 'Offer $50 fast-track option when seats are full.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSetting(key, !checked)}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
                        checked ? 'bg-[#6EA8FF]' : 'bg-white/20'
                      }`}
                      disabled={savingKey === key}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
                          checked ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
