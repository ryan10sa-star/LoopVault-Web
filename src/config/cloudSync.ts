export interface CloudSyncSettings {
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteCode: string;
  operatorName: string;
}

const CLOUD_SYNC_STORAGE_KEY = 'loopvault.cloudSync.v1';

const DEFAULT_CLOUD_SYNC_SETTINGS: CloudSyncSettings = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  siteCode: '',
  operatorName: ''
};

export function loadCloudSyncSettings(): CloudSyncSettings {
  const raw = localStorage.getItem(CLOUD_SYNC_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_CLOUD_SYNC_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CloudSyncSettings>;
    return {
      supabaseUrl: normalizeUrl(parsed.supabaseUrl),
      supabaseAnonKey: String(parsed.supabaseAnonKey ?? '').trim(),
      siteCode: String(parsed.siteCode ?? '').trim(),
      operatorName: String(parsed.operatorName ?? '').trim()
    };
  } catch {
    return DEFAULT_CLOUD_SYNC_SETTINGS;
  }
}

export function saveCloudSyncSettings(settings: CloudSyncSettings): void {
  const normalized: CloudSyncSettings = {
    supabaseUrl: normalizeUrl(settings.supabaseUrl),
    supabaseAnonKey: String(settings.supabaseAnonKey ?? '').trim(),
    siteCode: String(settings.siteCode ?? '').trim(),
    operatorName: String(settings.operatorName ?? '').trim()
  };
  localStorage.setItem(CLOUD_SYNC_STORAGE_KEY, JSON.stringify(normalized));
}

function normalizeUrl(value: unknown): string {
  return String(value ?? '').trim().replace(/\/+$/, '');
}