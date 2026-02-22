export interface SitePreferences {
  activeUserRole: UserRole;
  celebrationModeEnabled: boolean;
  preferredEquipmentManufacturer: string;
  inspectionSuggestions: InspectionSuggestions;
  pdfBranding: PdfBranding;
}

export type UserRole = 'tech' | 'lead' | 'admin';

export interface PdfBranding {
  companyName: string;
  logoDataUrl: string;
  letterheadDataUrl: string;
}

export interface InspectionSuggestions {
  nameplateTag: string[];
  installationConnections: string[];
  wiringShielding: string[];
  fallback: string[];
  other: string[];
}

const SITE_PREFERENCES_STORAGE_KEY = 'loopvault.sitePreferences.v1';
export const SITE_PREFERENCES_UPDATED_EVENT = 'loopvault:sitePreferencesUpdated';

export const DEFAULT_INSPECTION_SUGGESTIONS: InspectionSuggestions = {
  nameplateTag: [
    'Verify tag number and service match drawing/loop sheet.',
    'Check nameplate model/range against required instrument data.',
    'Confirm hazardous area/certification markings where applicable.',
    'Inspect for visible damage, corrosion, or missing covers/seals.'
  ],
  installationConnections: [
    'Confirm mounting orientation and support are secure.',
    'Check impulse/process connections for leaks, plugs, and proper isolation.',
    'Verify tubing/manifold routing is clean and mechanically protected.',
    'Confirm vent/drain configuration is appropriate for service.'
  ],
  wiringShielding: [
    'Confirm terminal IDs and polarity match drawings.',
    'Check for tight terminations and no loose strands/exposed conductors.',
    'Verify shield and grounding practice aligns with site standard.',
    'Inspect cable entry/glands for sealing and mechanical integrity.'
  ],
  fallback: [
    'Check condition, labeling, and physical integrity of the instrument setup.',
    'Verify installation and connections are correct for the intended service.',
    'Confirm wiring/termination and grounding are complete and compliant.',
    'Flag any deviation that could impact calibration quality or safety.'
  ],
  other: [
    'Add site-specific inspection guideline here.',
    'Add company policy rule or required acceptance criterion here.'
  ]
};

const DEFAULT_SITE_PREFERENCES: SitePreferences = {
  activeUserRole: 'tech',
  celebrationModeEnabled: true,
  preferredEquipmentManufacturer: '',
  inspectionSuggestions: DEFAULT_INSPECTION_SUGGESTIONS,
  pdfBranding: {
    companyName: '',
    logoDataUrl: '',
    letterheadDataUrl: ''
  }
};

export function loadSitePreferences(): SitePreferences {
  const raw = localStorage.getItem(SITE_PREFERENCES_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_SITE_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SitePreferences>;
    return {
      activeUserRole: normalizeUserRole(parsed.activeUserRole),
      celebrationModeEnabled: normalizeCelebrationMode(parsed.celebrationModeEnabled),
      preferredEquipmentManufacturer: String(parsed.preferredEquipmentManufacturer ?? '').trim(),
      inspectionSuggestions: normalizeInspectionSuggestions(parsed.inspectionSuggestions),
      pdfBranding: normalizePdfBranding(parsed.pdfBranding)
    };
  } catch {
    return DEFAULT_SITE_PREFERENCES;
  }
}

export function saveSitePreferences(prefs: SitePreferences): void {
  const normalized: SitePreferences = {
    activeUserRole: normalizeUserRole(prefs.activeUserRole),
    celebrationModeEnabled: normalizeCelebrationMode(prefs.celebrationModeEnabled),
    preferredEquipmentManufacturer: String(prefs.preferredEquipmentManufacturer ?? '').trim(),
    inspectionSuggestions: normalizeInspectionSuggestions(prefs.inspectionSuggestions),
    pdfBranding: normalizePdfBranding(prefs.pdfBranding)
  };
  localStorage.setItem(SITE_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SITE_PREFERENCES_UPDATED_EVENT));
  }
}

function normalizeUserRole(input: unknown): UserRole {
  const normalized = String(input ?? '').trim().toLowerCase();
  if (normalized === 'lead' || normalized === 'admin') {
    return normalized;
  }
  return 'tech';
}

function normalizeCelebrationMode(input: unknown): boolean {
  if (typeof input === 'boolean') {
    return input;
  }
  const normalized = String(input ?? '').trim().toLowerCase();
  if (normalized === 'false' || normalized === '0' || normalized === 'off') {
    return false;
  }
  return true;
}

function normalizePdfBranding(input: unknown): PdfBranding {
  const source = input && typeof input === 'object' ? (input as Partial<PdfBranding>) : {};
  return {
    companyName: String(source.companyName ?? '').trim(),
    logoDataUrl: String(source.logoDataUrl ?? '').trim(),
    letterheadDataUrl: String(source.letterheadDataUrl ?? '').trim()
  };
}

function normalizeInspectionSuggestions(input: unknown): InspectionSuggestions {
  const source = input && typeof input === 'object' ? (input as Partial<InspectionSuggestions>) : {};
  return {
    nameplateTag: normalizeLines(source.nameplateTag, DEFAULT_INSPECTION_SUGGESTIONS.nameplateTag),
    installationConnections: normalizeLines(source.installationConnections, DEFAULT_INSPECTION_SUGGESTIONS.installationConnections),
    wiringShielding: normalizeLines(source.wiringShielding, DEFAULT_INSPECTION_SUGGESTIONS.wiringShielding),
    fallback: normalizeLines(source.fallback, DEFAULT_INSPECTION_SUGGESTIONS.fallback),
    other: normalizeLines(source.other, DEFAULT_INSPECTION_SUGGESTIONS.other)
  };
}

function normalizeLines(input: unknown, fallback: string[]): string[] {
  if (!Array.isArray(input)) {
    return [...fallback];
  }
  const cleaned = input
    .map((value) => String(value ?? '').trim())
    .filter((value) => value.length > 0);
  return cleaned.length > 0 ? cleaned : [...fallback];
}

export const EQUIPMENT_MANUFACTURERS = [
  'Fluke',
  'Beamex',
  'Druck',
  'Additel',
  'Yokogawa',
  'WIKA',
  'Meriam',
  'Ashcroft',
  'GE',
  'Honeywell',
  'Rosemount',
  'Emerson'
] as const;
