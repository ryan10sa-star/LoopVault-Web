import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadCloudSyncSettings, saveCloudSyncSettings, type CloudSyncSettings } from '../config/cloudSync';
import { DEFAULT_INSPECTION_SUGGESTIONS, EQUIPMENT_MANUFACTURERS, loadSitePreferences, saveSitePreferences, type SitePreferences, type UserRole } from '../config/sitePreferences';
import { pullCloudSnapshot, pushCloudSnapshot, testCloudConnection } from '../utils/cloudSync';

interface CloudSyncHistory {
  lastSuccessAt: string;
  lastDirection: 'push' | 'pull' | '';
  lastUpdatedBy: string;
}

const CLOUD_SYNC_HISTORY_KEY = 'loopvault.cloudSync.lastSuccess.v1';

export function Settings(): JSX.Element {
  const [prefs, setPrefs] = useState<SitePreferences>({
    activeUserRole: 'tech',
    celebrationModeEnabled: true,
    preferredEquipmentManufacturer: '',
    inspectionSuggestions: DEFAULT_INSPECTION_SUGGESTIONS,
    pdfBranding: { companyName: '', logoDataUrl: '', letterheadDataUrl: '' }
  });
  const [selectedRole, setSelectedRole] = useState<UserRole>('tech');
  const [status, setStatus] = useState<string>('');
  const [cloud, setCloud] = useState<CloudSyncSettings>({
    supabaseUrl: '',
    supabaseAnonKey: '',
    siteCode: '',
    operatorName: ''
  });
  const [cloudBusy, setCloudBusy] = useState<boolean>(false);
  const [cloudStatus, setCloudStatus] = useState<string>('');
  const [cloudHistory, setCloudHistory] = useState<CloudSyncHistory>({
    lastSuccessAt: '',
    lastDirection: '',
    lastUpdatedBy: ''
  });

  useEffect(() => {
    const loaded = normalizePrefsForUi(loadSitePreferences());
    setPrefs(loaded);
    setSelectedRole(normalizeRole(loaded.activeUserRole));
    setCloud(loadCloudSyncSettings());
    setCloudHistory(loadCloudSyncHistory());
  }, []);

  const safePrefs = normalizePrefsForUi(prefs);
  const activeRole = normalizeRole(selectedRole);
  const isAdmin = activeRole === 'admin';

  const onSaveRole = (): void => {
    const current = loadSitePreferences();
    const nextRole = normalizeRole(selectedRole);
    saveSitePreferences({ ...current, activeUserRole: nextRole });
    setPrefs((existing) => ({ ...normalizePrefsForUi(existing), activeUserRole: nextRole }));
    setSelectedRole(nextRole);
    setStatus(`Active role saved: ${nextRole.toUpperCase()}.`);
  };

  const onSaveAdminSettings = (): void => {
    if (!isAdmin) {
      setStatus('Only Admin can save site policy and branding settings.');
      return;
    }
    saveSitePreferences(safePrefs);
    setStatus('Admin settings saved.');
  };

  const onBrandImageSelect = async (event: React.ChangeEvent<HTMLInputElement>, field: 'logoDataUrl' | 'letterheadDataUrl'): Promise<void> => {
    const inputEl = event.currentTarget;
    const file = inputEl.files?.[0];
    if (!file) {
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setPrefs((current) => ({
      ...normalizePrefsForUi(current),
      pdfBranding: {
        ...normalizePdfBrandingForUi(current.pdfBranding),
        [field]: dataUrl
      }
    }));
    setStatus(field === 'logoDataUrl' ? 'Logo loaded. Click Save Settings to persist.' : 'Letterhead loaded. Click Save Settings to persist.');
    inputEl.value = '';
  };

  const onSaveCloudSettings = (): void => {
    saveCloudSyncSettings(cloud);
    setCloudStatus('Cloud sync settings saved locally on this device.');
  };

  const onSaveCelebrationSettings = (): void => {
    const current = loadSitePreferences();
    saveSitePreferences({ ...current, celebrationModeEnabled: safePrefs.celebrationModeEnabled });
    setStatus(`Celebration mode ${safePrefs.celebrationModeEnabled ? 'enabled' : 'disabled'}.`);
  };

  const onPushCloud = async (): Promise<void> => {
    setCloudBusy(true);
    try {
      const summary = await pushCloudSnapshot(cloud);
      setCloudStatus(
        `Pushed snapshot (${summary.tags} tags, ${summary.jobs} jobs, ${summary.steps} steps, ${summary.signatures} signatures, ${summary.evidence} evidence files, ${summary.documents} documents).`
      );
      const nextHistory: CloudSyncHistory = {
        lastSuccessAt: new Date().toISOString(),
        lastDirection: 'push',
        lastUpdatedBy: cloud.operatorName || 'local-user'
      };
      setCloudHistory(nextHistory);
      saveCloudSyncHistory(nextHistory);
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : 'Cloud push failed.');
    } finally {
      setCloudBusy(false);
    }
  };

  const onPullCloud = async (): Promise<void> => {
    setCloudBusy(true);
    try {
      const summary = await pullCloudSnapshot(cloud);
      setCloudStatus(
        `Pulled snapshot from cloud by ${summary.updatedBy || 'unknown'} (${summary.tags} tags, ${summary.jobs} jobs, ${summary.steps} steps, ${summary.signatures} signatures, ${summary.evidence} evidence files, ${summary.documents} documents).`
      );
      const nextHistory: CloudSyncHistory = {
        lastSuccessAt: summary.updatedAt || new Date().toISOString(),
        lastDirection: 'pull',
        lastUpdatedBy: summary.updatedBy || 'unknown'
      };
      setCloudHistory(nextHistory);
      saveCloudSyncHistory(nextHistory);
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : 'Cloud pull failed.');
    } finally {
      setCloudBusy(false);
    }
  };

  const onTestCloudConnection = async (): Promise<void> => {
    setCloudBusy(true);
    try {
      const result = await testCloudConnection(cloud);
      setCloudStatus(
        result.snapshotsTableReachable && result.blobChunksTableReachable
          ? 'Cloud connection OK. sync_snapshots and sync_blob_chunks are reachable.'
          : 'Cloud connection incomplete. Check Supabase table setup.'
      );
    } catch (error) {
      setCloudStatus(error instanceof Error ? error.message : 'Cloud connection test failed.');
    } finally {
      setCloudBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Settings</h2>
      <p className="text-sm text-slate-300">Set site defaults and preferences for field workflow behavior.</p>

      <article className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="text-base font-semibold text-safety">Role & Access</h3>
        <p className="text-xs text-slate-400">Role controls destructive actions and governance-level updates.</p>
        <label className="block text-sm text-slate-300">
          Active Role
          <select
            className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-base text-white"
            onChange={(event) => setSelectedRole(normalizeRole(event.currentTarget.value))}
            value={activeRole}
          >
            <option value="tech">Tech</option>
            <option value="lead">Lead</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button className="min-h-[44px] rounded-lg bg-safety px-4 py-3 text-sm font-bold text-black" onClick={onSaveRole} type="button">
          Save Role
        </button>
      </article>

      <p className={`rounded-lg border p-3 text-xs ${isAdmin ? 'border-emerald-500 bg-emerald-950 text-emerald-100' : 'border-amber-500 bg-amber-950/40 text-amber-100'}`}>
        Access mode: {isAdmin ? 'Admin unlocked — policy and branding edits enabled.' : 'Tech/Lead locked — policy and branding edits are view-only.'}
      </p>

      <article className="space-y-3 rounded-xl border border-violet-500 bg-violet-950/20 p-4">
        <h3 className="text-base font-semibold text-violet-200">Celebrations & Easter Eggs</h3>
        <p className="text-xs text-violet-100">Adds completion sound, confetti, and hidden delight triggers around the app.</p>
        <label className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-violet-700 bg-slate-900 px-3 py-2 text-sm text-violet-100">
          <input
            checked={safePrefs.celebrationModeEnabled}
            onChange={(event) => {
              const checked = event.currentTarget.checked;
              setPrefs((current) => ({ ...normalizePrefsForUi(current), celebrationModeEnabled: checked }));
            }}
            type="checkbox"
          />
          Enable celebration mode
        </label>
        <button className="min-h-[44px] rounded-lg bg-violet-200 px-4 py-3 text-sm font-bold text-slate-900" onClick={onSaveCelebrationSettings} type="button">
          Save Celebration Settings
        </button>
      </article>

      <fieldset className="space-y-3" disabled={!isAdmin}>
      <article className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="text-base font-semibold text-safety">Site Preferences</h3>
        <label className="block text-sm text-slate-300">
          Preferred Test Equipment Manufacturer
          <select
            className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-base text-white"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setPrefs((current) => ({ ...normalizePrefsForUi(current), preferredEquipmentManufacturer: value }));
            }}
            value={safePrefs.preferredEquipmentManufacturer}
          >
            <option value="">No preference</option>
            {EQUIPMENT_MANUFACTURERS.map((manufacturer) => (
              <option key={manufacturer} value={manufacturer}>
                {manufacturer}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-slate-400">This moves matching equipment models to the top of the quick-select list in calibration jobs.</p>
      </article>

      <article className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="text-base font-semibold text-safety">Inspection Checklist Policy</h3>
        <p className="text-xs text-slate-400">One bullet per line. These lists power the suggested checks dropdown shown on calibration inspection pass/fail steps.</p>

        <label className="block text-sm text-slate-300">
          Nameplate / Tag Suggested Checks
          <textarea
            className="mt-2 min-h-[120px] w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-sm text-white"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setPrefs((current) => ({
                ...normalizePrefsForUi(current),
                inspectionSuggestions: {
                  ...normalizeInspectionSuggestionsForUi(current.inspectionSuggestions),
                  nameplateTag: parseChecklistLines(value)
                }
              }));
            }}
            value={safePrefs.inspectionSuggestions.nameplateTag.join('\n')}
          />
        </label>

        <label className="block text-sm text-slate-300">
          Installation / Connections Suggested Checks
          <textarea
            className="mt-2 min-h-[120px] w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-sm text-white"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setPrefs((current) => ({
                ...normalizePrefsForUi(current),
                inspectionSuggestions: {
                  ...normalizeInspectionSuggestionsForUi(current.inspectionSuggestions),
                  installationConnections: parseChecklistLines(value)
                }
              }));
            }}
            value={safePrefs.inspectionSuggestions.installationConnections.join('\n')}
          />
        </label>

        <label className="block text-sm text-slate-300">
          Wiring / Shielding Suggested Checks
          <textarea
            className="mt-2 min-h-[120px] w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-sm text-white"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setPrefs((current) => ({
                ...normalizePrefsForUi(current),
                inspectionSuggestions: {
                  ...normalizeInspectionSuggestionsForUi(current.inspectionSuggestions),
                  wiringShielding: parseChecklistLines(value)
                }
              }));
            }}
            value={safePrefs.inspectionSuggestions.wiringShielding.join('\n')}
          />
        </label>

        <label className="block text-sm text-slate-300">
          Default Suggested Checks (Fallback)
          <textarea
            className="mt-2 min-h-[120px] w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-sm text-white"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setPrefs((current) => ({
                ...normalizePrefsForUi(current),
                inspectionSuggestions: {
                  ...normalizeInspectionSuggestionsForUi(current.inspectionSuggestions),
                  fallback: parseChecklistLines(value)
                }
              }));
            }}
            value={safePrefs.inspectionSuggestions.fallback.join('\n')}
          />
        </label>

        <label className="block text-sm text-slate-300">
          Other (Site-specific) Suggested Checks
          <textarea
            className="mt-2 min-h-[120px] w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-sm text-white"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setPrefs((current) => ({
                ...normalizePrefsForUi(current),
                inspectionSuggestions: {
                  ...normalizeInspectionSuggestionsForUi(current.inspectionSuggestions),
                  other: parseChecklistLines(value)
                }
              }));
            }}
            value={safePrefs.inspectionSuggestions.other.join('\n')}
          />
        </label>
      </article>

      <article className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="text-base font-semibold text-safety">Document Branding</h3>
        <p className="text-xs text-slate-400">Apply official company branding to generated generic Loop Folder PDFs.</p>

        <label className="block text-sm text-slate-300">
          Company Name
          <input
            className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-base text-white"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setPrefs((current) => ({
                ...normalizePrefsForUi(current),
                pdfBranding: {
                  ...normalizePdfBrandingForUi(current.pdfBranding),
                  companyName: value
                }
              }));
            }}
            placeholder="Acme Industrial Services"
            type="text"
            value={safePrefs.pdfBranding.companyName}
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block min-h-[44px] rounded-lg border border-slate-500 bg-slate-100 px-3 py-2 text-center text-sm font-semibold text-slate-900">
            Upload Logo
            <input accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void onBrandImageSelect(event, 'logoDataUrl')} type="file" />
          </label>
          <button
            className="min-h-[44px] rounded-lg border border-slate-400 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900"
            onClick={() =>
              setPrefs((current) => ({
                ...normalizePrefsForUi(current),
                pdfBranding: {
                  ...normalizePdfBrandingForUi(current.pdfBranding),
                  logoDataUrl: ''
                }
              }))
            }
            type="button"
          >
            Clear Logo
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block min-h-[44px] rounded-lg border border-slate-500 bg-slate-100 px-3 py-2 text-center text-sm font-semibold text-slate-900">
            Upload Letterhead
            <input accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void onBrandImageSelect(event, 'letterheadDataUrl')} type="file" />
          </label>
          <button
            className="min-h-[44px] rounded-lg border border-slate-400 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900"
            onClick={() =>
              setPrefs((current) => ({
                ...normalizePrefsForUi(current),
                pdfBranding: {
                  ...normalizePdfBrandingForUi(current.pdfBranding),
                  letterheadDataUrl: ''
                }
              }))
            }
            type="button"
          >
            Clear Letterhead
          </button>
        </div>

        <p className="text-xs text-slate-400">If both are provided, letterhead is used as the top banner and logo is ignored for the header.</p>

        <div className="rounded-lg border border-slate-600 bg-slate-900 p-3">
          <p className="text-xs font-semibold text-slate-300">Header Preview</p>
          <div className="mt-2 rounded-md border border-slate-500 bg-white p-3 text-slate-900">
            {safePrefs.pdfBranding.letterheadDataUrl ? (
              <img alt="Letterhead preview" className="h-16 w-full rounded object-cover" src={safePrefs.pdfBranding.letterheadDataUrl} />
            ) : (
              <div className="flex min-h-[64px] items-center gap-3">
                {safePrefs.pdfBranding.logoDataUrl ? <img alt="Logo preview" className="h-12 w-28 rounded object-contain" src={safePrefs.pdfBranding.logoDataUrl} /> : null}
                <p className="text-base font-semibold">{safePrefs.pdfBranding.companyName || 'Company Name'}</p>
              </div>
            )}
          </div>
        </div>
      </article>

      </fieldset>

      <article className="space-y-3 rounded-xl border border-cyan-500 bg-cyan-950/20 p-4">
        <h3 className="text-base font-semibold text-cyan-200">Cloud Sync (MVP)</h3>
        <p className="text-xs text-cyan-100">No-cost pilot path: use Supabase free tier + shared site code to exchange completed work across tech/supervisor devices.</p>
        <p className="text-xs text-cyan-100">Current MVP syncs core records and file blobs (photos, signatures, and tag documents) using chunked cloud transfer.</p>

        <label className="block text-sm text-cyan-100">
          Supabase Project URL
          <input
            className="mt-2 min-h-[44px] w-full rounded-lg border border-cyan-700 bg-slate-900 p-3 text-base text-white"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setCloud((current) => ({ ...current, supabaseUrl: value }));
            }}
            placeholder="https://YOUR-PROJECT.supabase.co"
            type="text"
            value={cloud.supabaseUrl}
          />
        </label>

        <label className="block text-sm text-cyan-100">
          Supabase Anon Key
          <input
            className="mt-2 min-h-[44px] w-full rounded-lg border border-cyan-700 bg-slate-900 p-3 text-base text-white"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setCloud((current) => ({ ...current, supabaseAnonKey: value }));
            }}
            placeholder="eyJhbGci..."
            type="password"
            value={cloud.supabaseAnonKey}
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-sm text-cyan-100">
            Shared Site Code
            <input
              className="mt-2 min-h-[44px] w-full rounded-lg border border-cyan-700 bg-slate-900 p-3 text-base text-white"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setCloud((current) => ({ ...current, siteCode: value }));
              }}
              placeholder="plant-a-turnaround"
              type="text"
              value={cloud.siteCode}
            />
          </label>

          <label className="block text-sm text-cyan-100">
            Operator Name
            <input
              className="mt-2 min-h-[44px] w-full rounded-lg border border-cyan-700 bg-slate-900 p-3 text-base text-white"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setCloud((current) => ({ ...current, operatorName: value }));
              }}
              placeholder="Supervisor-JSmith"
              type="text"
              value={cloud.operatorName}
            />
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          <button className="min-h-[44px] rounded-lg bg-cyan-300 px-3 py-2 text-sm font-bold text-slate-900" onClick={onSaveCloudSettings} type="button">
            Save Sync Config
          </button>
          <button className="min-h-[44px] rounded-lg bg-cyan-100 px-3 py-2 text-sm font-semibold text-slate-900" disabled={cloudBusy} onClick={() => void onTestCloudConnection()} type="button">
            {cloudBusy ? 'Working…' : 'Test Connection'}
          </button>
          <button className="min-h-[44px] rounded-lg bg-safety px-3 py-2 text-sm font-bold text-black" disabled={cloudBusy} onClick={() => void onPushCloud()} type="button">
            {cloudBusy ? 'Working…' : 'Push to Cloud'}
          </button>
          <button className="min-h-[44px] rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900" disabled={cloudBusy} onClick={() => void onPullCloud()} type="button">
            {cloudBusy ? 'Working…' : 'Pull from Cloud'}
          </button>
        </div>

        {cloudStatus ? <p className="text-xs text-cyan-100">{cloudStatus}</p> : null}
        {cloudHistory.lastSuccessAt ? (
          <p className="text-xs text-cyan-200">
            Last successful cloud sync: {new Date(cloudHistory.lastSuccessAt).toLocaleString()} • {cloudHistory.lastDirection.toUpperCase()} • by {cloudHistory.lastUpdatedBy || 'unknown'}
          </p>
        ) : (
          <p className="text-xs text-cyan-200">Last successful cloud sync: none yet.</p>
        )}
      </article>

      <button className={`min-h-[44px] rounded-lg px-4 py-3 text-sm font-bold ${isAdmin ? 'bg-safety text-black' : 'bg-slate-600 text-slate-300'}`} onClick={onSaveAdminSettings} type="button">
        Save Site Settings (Admin)
      </button>

      {status ? <p className="rounded-lg border border-emerald-400 bg-emerald-950 p-3 text-sm font-semibold text-emerald-100">✓ {status}</p> : null}

      <Link className="inline-flex min-h-[44px] items-center rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900" to="/help">
        Help & Docs
      </Link>
    </section>
  );
}

function parseChecklistLines(input: string): string[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function normalizeRole(input: unknown): UserRole {
  const normalized = String(input ?? '').trim().toLowerCase();
  if (normalized === 'lead' || normalized === 'admin') {
    return normalized;
  }
  return 'tech';
}

function normalizePrefsForUi(input: SitePreferences): SitePreferences {
  return {
    activeUserRole: normalizeRole(input.activeUserRole),
    celebrationModeEnabled: Boolean(input.celebrationModeEnabled),
    preferredEquipmentManufacturer: String(input.preferredEquipmentManufacturer ?? ''),
    inspectionSuggestions: normalizeInspectionSuggestionsForUi(input.inspectionSuggestions),
    pdfBranding: normalizePdfBrandingForUi(input.pdfBranding)
  };
}

function normalizeInspectionSuggestionsForUi(input: unknown): SitePreferences['inspectionSuggestions'] {
  const source = input && typeof input === 'object' ? (input as Partial<SitePreferences['inspectionSuggestions']>) : {};
  const toLines = (value: unknown, fallback: string[]): string[] => {
    if (!Array.isArray(value)) {
      return [...fallback];
    }
    const lines = value.map((item) => String(item ?? '').trim()).filter((item) => item.length > 0);
    return lines.length > 0 ? lines : [...fallback];
  };

  return {
    nameplateTag: toLines(source.nameplateTag, DEFAULT_INSPECTION_SUGGESTIONS.nameplateTag),
    installationConnections: toLines(source.installationConnections, DEFAULT_INSPECTION_SUGGESTIONS.installationConnections),
    wiringShielding: toLines(source.wiringShielding, DEFAULT_INSPECTION_SUGGESTIONS.wiringShielding),
    fallback: toLines(source.fallback, DEFAULT_INSPECTION_SUGGESTIONS.fallback),
    other: toLines(source.other, DEFAULT_INSPECTION_SUGGESTIONS.other)
  };
}

function normalizePdfBrandingForUi(input: unknown): SitePreferences['pdfBranding'] {
  const source = input && typeof input === 'object' ? (input as Partial<SitePreferences['pdfBranding']>) : {};
  return {
    companyName: String(source.companyName ?? ''),
    logoDataUrl: String(source.logoDataUrl ?? ''),
    letterheadDataUrl: String(source.letterheadDataUrl ?? '')
  };
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read image file.'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

function loadCloudSyncHistory(): CloudSyncHistory {
  const raw = localStorage.getItem(CLOUD_SYNC_HISTORY_KEY);
  if (!raw) {
    return { lastSuccessAt: '', lastDirection: '', lastUpdatedBy: '' };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<CloudSyncHistory>;
    const direction = parsed.lastDirection === 'push' || parsed.lastDirection === 'pull' ? parsed.lastDirection : '';
    return {
      lastSuccessAt: String(parsed.lastSuccessAt ?? '').trim(),
      lastDirection: direction,
      lastUpdatedBy: String(parsed.lastUpdatedBy ?? '').trim()
    };
  } catch {
    return { lastSuccessAt: '', lastDirection: '', lastUpdatedBy: '' };
  }
}

function saveCloudSyncHistory(history: CloudSyncHistory): void {
  localStorage.setItem(CLOUD_SYNC_HISTORY_KEY, JSON.stringify(history));
}
