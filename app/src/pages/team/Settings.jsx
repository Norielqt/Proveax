import { useEffect, useState } from 'react';
import { SettingsSkeleton } from '../../components/Skeleton';
import { getTeamSettings, updateTeamSettings } from '../../api/team';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => { getTeamSettings().then(setSettings).catch(() => setSettings({})); }, []);

  if (!settings) {
    return <SettingsSkeleton />;
  }

  const change = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true); setNotice(null);
    try {
      const fresh = await updateTeamSettings({
        screenshot_retention_days:   Number(settings.screenshot_retention_days),
        screenshot_interval_minutes: Number(settings.screenshot_interval_minutes),
        idle_timeout_minutes:        Number(settings.idle_timeout_minutes),
        screenshots_required:        !!settings.screenshots_required,
        consent_text:                settings.consent_text ?? '',
      });
      setSettings(fresh);
      setNotice({ type: 'success', text: 'Settings saved.' });
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Failed to save.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">My Team</p>
      <h1 className="mt-1 font-display text-4xl leading-none tracking-tight text-[#111]">Settings</h1>
      <p className="mt-2 text-sm text-[#5a5a55]">Configure how work sessions, screenshots, and data retention behave for your team.</p>

      {notice && (
        <div className={`mt-4 rounded-md border px-3 py-2 text-sm ${
          notice.type === 'success' ? 'border-black/[0.08] bg-white text-[#111]' : 'border-black/[0.1] bg-[#fafafa] text-[#111]'
        }`}>{notice.text}</div>
      )}

      <div className="mt-8 space-y-4">
        {/* Screenshots */}
        <div className="rounded-2xl border border-black/[0.06] bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#888]">Screenshots</p>
              <p className="mt-2 text-sm text-[#5a5a55]">Periodic screen captures during active work sessions.</p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={!!settings.screenshots_required}
                onChange={(e) => change('screenshots_required', e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm text-[#5a5a55]">Required</span>
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Capture interval (minutes)"
              hint="How often to capture a screenshot. Min 5, max 60."
              value={settings.screenshot_interval_minutes}
              onChange={(v) => change('screenshot_interval_minutes', v)}
              min={5} max={60}
            />
            <Field
              label="Retention (days)"
              hint="Screenshots older than this are auto-deleted. Max 90."
              value={settings.screenshot_retention_days}
              onChange={(v) => change('screenshot_retention_days', v)}
              min={1} max={90}
            />
          </div>
        </div>

        {/* Idle */}
        <div className="rounded-2xl border border-black/[0.06] bg-white p-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#888]">Idle detection</p>
          <p className="mt-2 text-sm text-[#5a5a55]">When no mouse/keyboard activity is detected for this long, the session is paused automatically.</p>
          <div className="mt-4 max-w-xs">
            <Field
              label="Idle timeout (minutes)"
              value={settings.idle_timeout_minutes}
              onChange={(v) => change('idle_timeout_minutes', v)}
              min={1} max={30}
            />
          </div>
        </div>

        {/* Consent */}
        <div className="rounded-2xl border border-black/[0.06] bg-white p-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#888]">Consent notice</p>
          <p className="mt-2 text-sm text-[#5a5a55]">Shown to team members the first time they log in. They must accept before any monitoring takes place.</p>
          <textarea
            rows={9}
            value={settings.consent_text ?? ''}
            onChange={(e) => change('consent_text', e.target.value)}
            className="mt-3 w-full rounded-xl border border-black/[0.09] bg-white px-3 py-2 text-sm focus:border-[#111] focus:outline-none focus:ring-2 focus:ring-black/[0.06]"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-full bg-[#111] px-5 py-2 text-sm font-semibold text-white hover:bg-[#2a2a2a] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, value, onChange, min, max }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#5a5a55]">{label}</span>
      <input
        type="number" min={min} max={max}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-xl border border-black/[0.09] bg-white px-3 py-2 text-sm focus:border-[#111] focus:outline-none focus:ring-2 focus:ring-black/[0.06]"
      />
      {hint && <span className="mt-1 block text-xs text-[#aaa]">{hint}</span>}
    </label>
  );
}
