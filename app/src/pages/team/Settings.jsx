import { useEffect, useState } from 'react';
import { getTeamSettings, updateTeamSettings } from '../../api/team';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => { getTeamSettings().then(setSettings); }, []);

  if (!settings) {
    return <div className="text-sm text-gray-500">Loading…</div>;
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
      <h1 className="text-2xl font-bold text-gray-900">Monitoring settings</h1>
      <p className="mt-1 text-sm text-gray-500">Configure how work sessions, screenshots, and data retention behave for your team.</p>

      {notice && (
        <div className={`mt-4 rounded-md border px-3 py-2 text-sm ${
          notice.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'
        }`}>{notice.text}</div>
      )}

      <div className="mt-6 space-y-4">
        {/* Screenshots */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-900">Screenshots</h2>
              <p className="mt-1 text-xs text-gray-500">Periodic screen captures during active work sessions.</p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={!!settings.screenshots_required}
                onChange={(e) => change('screenshots_required', e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm text-gray-700">Required</span>
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
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-900">Idle detection</h2>
          <p className="mt-1 text-xs text-gray-500">When no mouse/keyboard activity is detected for this long, the session is paused automatically.</p>
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
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-900">Consent notice</h2>
          <p className="mt-1 text-xs text-gray-500">Shown to team members the first time they log in. They must accept before any monitoring takes place.</p>
          <textarea
            rows={9}
            value={settings.consent_text ?? ''}
            onChange={(e) => change('consent_text', e.target.value)}
            className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
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
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <input
        type="number" min={min} max={max}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
      />
      {hint && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    </label>
  );
}
