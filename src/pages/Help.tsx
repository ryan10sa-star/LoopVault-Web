import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { MAX_DOCUMENT_BYTES, MAX_DOCUMENT_BYTES_GLOBAL, MAX_DOCUMENT_BYTES_PER_TAG, MAX_DOCUMENTS_PER_TAG } from '../config/appLimits';

export function Help(): JSX.Element {
  const [customTemplateName, setCustomTemplateName] = useState<string>('');
  const [customTemplateContent, setCustomTemplateContent] = useState<string>('');
  const [templateStatus, setTemplateStatus] = useState<string>('');
  const [activeReference, setActiveReference] = useState<'conversions' | 'formulas' | 'standards' | null>(null);

  useEffect(() => {
    const savedName = localStorage.getItem('loopvault.customHandoverTemplateName') ?? '';
    const savedContent = localStorage.getItem('loopvault.customHandoverTemplateContent') ?? '';
    if (!savedName || !savedContent) {
      return;
    }
    setCustomTemplateName(savedName);
    setCustomTemplateContent(savedContent);
    setTemplateStatus(`Loaded saved custom template: ${savedName}`);
  }, []);

  const onCustomTemplateSelected = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      if (!content.trim()) {
        setTemplateStatus('Template file is empty.');
        return;
      }
      setCustomTemplateName(file.name);
      setCustomTemplateContent(content);
      localStorage.setItem('loopvault.customHandoverTemplateName', file.name);
      localStorage.setItem('loopvault.customHandoverTemplateContent', content);
      setTemplateStatus(`Custom template saved offline: ${file.name}`);
      event.currentTarget.value = '';
    } catch {
      setTemplateStatus('Failed to load custom template.');
    }
  };

  const onDownloadCustomTemplate = (): void => {
    if (!customTemplateName || !customTemplateContent) {
      setTemplateStatus('No custom template loaded.');
      return;
    }

    const blob = new Blob([customTemplateContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = customTemplateName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const onClearCustomTemplate = (): void => {
    localStorage.removeItem('loopvault.customHandoverTemplateName');
    localStorage.removeItem('loopvault.customHandoverTemplateContent');
    setCustomTemplateName('');
    setCustomTemplateContent('');
    setTemplateStatus('Custom template cleared.');
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Offline Help & Documentation</h2>
      <p className="text-sm text-slate-300">This in-app manual is available offline and documents the required LoopVault workflows and data formats.</p>

      <article className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="text-base font-semibold text-safety">App Capabilities</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
          <li>Offline-first operation with local IndexedDB persistence for tags, jobs, steps, evidence, and signatures.</li>
          <li>Bulk master tag import from CSV with fast local search and filtered navigation by tag details.</li>
          <li>QR workflow support for both scanning existing tags and creating missing tags from scanned values.</li>
          <li>Loop Check and Calibration job execution with touch-friendly controls and in-process metadata updates.</li>
          <li>Calibration workflow modes for Maintenance/T-A, New Construction, Right Out Of Box, and Commissioning (new install).</li>
          <li>Calibration data mode supports either Single Pass or As Found + As Left entry with inspection checklist-driven field execution.</li>
          <li>DP flow jobs include a required confirmation point for square-root extraction location (transmitter, control board/system, legacy extractor, or N/A).</li>
          <li>Calibration metadata includes quick-select test equipment models, plus Other (custom make/model) and dedicated S/N entry.</li>
          <li>Settings screen supports site preference for test-equipment manufacturer so quick-select lists can prioritize local standards.</li>
          <li>Per-tag document vault for loop sheets, P&amp;IDs, datasheets, and manuals with offline upload/download/delete controls.</li>
          <li>
            Document guardrails for mobile offline use: {Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB per file, {MAX_DOCUMENTS_PER_TAG} files per tag,
            {Math.round(MAX_DOCUMENT_BYTES_PER_TAG / (1024 * 1024))} MB per-tag cap, and {Math.round(MAX_DOCUMENT_BYTES_GLOBAL / (1024 * 1024))} MB app cap.
          </li>
          <li>Photo evidence capture from device camera/gallery and signature capture for turnover records.</li>
          <li>Dual export model: standard generated PDF packages and BYOF AcroForm fill workflows.</li>
          <li>ZIP backup and restore for full local data portability and recovery.</li>
        </ul>
        <div className="mt-3 rounded-lg border border-slate-600 bg-slate-900 p-3 text-xs text-slate-300">
          <p className="font-semibold text-slate-100">Storage Footprint (Phone/Tablet)</p>
          <p>Base app install/cache is typically around 2 MB.</p>
          <p>Most growth comes from field uploads (photos and documents), not app code.</p>
          <p>
            Document limits are enforced at {Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB/file, {MAX_DOCUMENTS_PER_TAG} files/tag,
            {Math.round(MAX_DOCUMENT_BYTES_PER_TAG / (1024 * 1024))} MB/tag, and {Math.round(MAX_DOCUMENT_BYTES_GLOBAL / (1024 * 1024))} MB app-wide for mobile reliability.
          </p>
          <p>Use Diagnostics to monitor used/remaining storage and export ZIP backups before long campaigns.</p>
        </div>
      </article>

      <details className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <summary className="cursor-pointer text-base font-semibold text-safety">Engineering Quick References (Advanced)</summary>
        <p className="text-sm text-slate-200">Tap a reference button to open common field calculations and unit standards.</p>

        <div className="grid gap-2 sm:grid-cols-3">
          <button
            className={`min-h-[44px] rounded-lg px-3 py-2 text-sm font-bold ${activeReference === 'conversions' ? 'bg-safety text-black' : 'bg-slate-100 text-slate-900'}`}
            onClick={() => setActiveReference((current) => (current === 'conversions' ? null : 'conversions'))}
            type="button"
          >
            Unit Conversions
          </button>
          <button
            className={`min-h-[44px] rounded-lg px-3 py-2 text-sm font-bold ${activeReference === 'formulas' ? 'bg-safety text-black' : 'bg-slate-100 text-slate-900'}`}
            onClick={() => setActiveReference((current) => (current === 'formulas' ? null : 'formulas'))}
            type="button"
          >
            Instrument Formulas
          </button>
          <button
            className={`min-h-[44px] rounded-lg px-3 py-2 text-sm font-bold ${activeReference === 'standards' ? 'bg-safety text-black' : 'bg-slate-100 text-slate-900'}`}
            onClick={() => setActiveReference((current) => (current === 'standards' ? null : 'standards'))}
            type="button"
          >
            Standard Scales
          </button>
        </div>

        {activeReference === 'conversions' ? (
          <div className="rounded-lg border border-slate-600 bg-slate-900 p-3 text-sm text-slate-200">
            <p className="font-semibold text-slate-100">Pressure / Vacuum</p>
            <p>1 bar = 14.5038 psi</p>
            <p>1 psi = 27.6807 inH₂O</p>
            <p>1 inHg = 13.5951 inH₂O</p>
            <p>100 inH₂O ≈ 3.613 psi</p>
            <p className="mt-2 font-semibold text-slate-100">Temperature</p>
            <p>°F = (°C × 9/5) + 32</p>
            <p>°C = (°F - 32) × 5/9</p>
          </div>
        ) : null}

        {activeReference === 'formulas' ? (
          <div className="rounded-lg border border-slate-600 bg-slate-900 p-3 text-sm text-slate-200">
            <p className="font-semibold text-slate-100">Linear 4-20mA Scaling</p>
            <p>mA = 4 + 16 × ((Input - LRV) / (URV - LRV))</p>
            <p>Input = LRV + (URV - LRV) × ((mA - 4) / 16)</p>
            <p className="mt-2 font-semibold text-slate-100">Square-Root Output</p>
            <p>mA = 4 + 16 × sqrt((Input - LRV) / (URV - LRV))</p>
            <p className="mt-2 font-semibold text-slate-100">Percent Span Error</p>
            <p>% Error = ((Actual - Expected) / 16) × 100</p>
          </div>
        ) : null}

        {activeReference === 'standards' ? (
          <div className="rounded-lg border border-slate-600 bg-slate-900 p-3 text-sm text-slate-200">
            <p className="font-semibold text-slate-100">Common Instrument Units</p>
            <p>inH₂O (inches water column)</p>
            <p>inHg (inches mercury)</p>
            <p>psi, kPa, bar, mbar</p>
            <p>°C, °F</p>
            <p>% level, % open, % speed</p>
            <p className="mt-2 font-semibold text-slate-100">Signal Standards</p>
            <p>4-20mA analog (live-zero)</p>
            <p>1-5V equivalent of 4-20mA via 250Ω</p>
            <p>Discrete: dry contact / 24VDC DI/DO</p>
          </div>
        ) : null}
      </details>

      <article className="space-y-2 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="text-base font-semibold text-safety">Workflow Guide (5 Steps)</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-200">
          <li>Import the master tag list from CSV.</li>
          <li>Scan or select a tag, then start a Loop Check or Calibration job and choose the calibration context/mode.</li>
          <li>Execute inspection checklist items, record measurements, and attach photo evidence as needed.</li>
          <li>Capture technician signature and complete the job.</li>
          <li>Export the turnover package (standard PDF or BYOF PDF), then back up ZIP.</li>
        </ol>
      </article>

      <article className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="text-base font-semibold text-safety">CSV Standards</h3>
        <p className="text-sm text-slate-200">Use a header row with the following fields. Required fields must be present on every row.</p>

        <div className="space-y-2 text-sm">
          <div>
            <p className="font-semibold text-slate-100">Required Headers</p>
            <p className="text-slate-300">tag_number, description, area, unit, service</p>
          </div>
          <div>
            <p className="font-semibold text-slate-100">Optional Headers</p>
            <p className="text-slate-300">type, plant, instrument_role, safety_layer, voting_logic, control_system, sil_target, proof_test_interval, bypass_permit_required, functional_owner, lrv, urv, eng_unit, transfer_function, fail_safe, max_error, test_equipment, test_equip_cal_date</p>
          </div>
          <div>
            <p className="font-semibold text-slate-100">Migration Note</p>
            <p className="text-slate-300">Legacy mte usage is replaced by testEquipment and testEquipmentCalDate metadata fields.</p>
          </div>
        </div>

        <a className="inline-flex min-h-[44px] items-center rounded-lg bg-safety px-4 py-3 text-sm font-bold text-black" download href="/template-tags.csv">
          Download Template CSV
        </a>
      </article>

      <details className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <summary className="cursor-pointer text-base font-semibold text-safety">BYOF PDF API Guide (Advanced)</summary>
        <p className="text-sm text-slate-200">Custom AcroForm PDFs must use exact text-field names so LoopVault can auto-populate values.</p>

        <div className="space-y-2 rounded-lg border border-slate-600 bg-slate-900 p-3 text-sm text-slate-200">
          <p className="font-semibold text-slate-100">Export Type Guide</p>
          <p>
            <span className="font-semibold text-safety">Standard PDF:</span> Use when you need a consistent LoopVault-generated certificate with calibration/loop data,
            signatures, and appendices in a fixed format.
          </p>
          <p>
            <span className="font-semibold text-safety">BYOF PDF:</span> Use when your site requires a plant-specific fillable form. LoopVault maps job/tag values into your
            AcroForm fields and exports the completed document.
          </p>
        </div>

        <div className="rounded-lg border border-slate-600 bg-slate-900 p-3 text-sm text-slate-200">
          <p>tagNumber</p>
          <p>description</p>
          <p>area</p>
          <p>unit</p>
          <p>service</p>
          <p>instrumentRole</p>
          <p>safetyLayer</p>
          <p>votingLogic</p>
          <p>controlSystem</p>
          <p>silTarget</p>
          <p>proofTestInterval</p>
          <p>bypassPermitRequired</p>
          <p>functionalOwner</p>
          <p>lrv</p>
          <p>urv</p>
          <p>engUnit</p>
          <p>transferFunction</p>
          <p>failSafe</p>
          <p>maxError</p>
          <p>testEquipment</p>
          <p>testEquipmentCalDate</p>
          <p>as_found_50_actual</p>
        </div>

        <p className="text-xs text-slate-400">If a field name is missing or misspelled in your PDF, LoopVault skips it and continues export.</p>
      </details>

      <article className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="text-base font-semibold text-safety">Troubleshooting</h3>
        <div className="space-y-2 text-sm text-slate-200">
          <p>
            <span className="font-semibold text-slate-100">Camera denied while scanning:</span> Allow camera permission in browser/site settings, then reopen the Scanner.
          </p>
          <p>
            <span className="font-semibold text-slate-100">CSV import rejected:</span> Verify required headers are present exactly: tag_number, description, area, unit,
            service.
          </p>
          <p>
            <span className="font-semibold text-slate-100">BYOF fields not populated:</span> Ensure AcroForm text-field names exactly match the names listed in this Help
            guide (case-sensitive).
          </p>
        </div>
        <Link className="inline-flex min-h-[44px] items-center rounded-lg bg-safety px-4 py-3 text-sm font-bold text-black" to="/diagnostics">
          Open Diagnostics
        </Link>
      </article>

      <article className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="text-base font-semibold text-safety">Pre-Job Readiness Checklist</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
          <li>Confirm tag list import is complete and searchable for your unit/area scope.</li>
          <li>Verify camera permission is granted before entering field walkdowns.</li>
          <li>Verify storage persistence is granted in Diagnostics to reduce eviction risk.</li>
          <li>Perform a ZIP backup before major edits or turnaround execution windows.</li>
          <li>Confirm test equipment ID and calibration due date are entered before calibration runs.</li>
        </ul>
      </article>

      <article className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="text-base font-semibold text-safety">Calibration Acceptance Rules</h3>
        <div className="space-y-2 text-sm text-slate-200">
          <p>
            <span className="font-semibold text-slate-100">Linear transfer:</span> Expected mA = 4 + 16 × ((Input - LRV) / (URV - LRV))
          </p>
          <p>
            <span className="font-semibold text-slate-100">Square-root transfer:</span> Expected mA = 4 + 16 × sqrt((Input - LRV) / (URV - LRV))
          </p>
          <p>
            <span className="font-semibold text-slate-100">Pass/Fail intent:</span> compare as-found/as-left error against max error threshold and flag out-of-tolerance points for correction.
          </p>
        </div>
      </article>

      <article className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="text-base font-semibold text-safety">Evidence Quality Standard</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
          <li>Capture clear tag nameplate and loop ID reference in at least one photo.</li>
          <li>Capture instrument reading/equipment display for as-found and as-left states.</li>
          <li>Capture hookup/config evidence when corrective work is performed.</li>
          <li>Avoid blurred/obstructed images; retake immediately while still at device.</li>
        </ul>
      </article>

      <article className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="text-base font-semibold text-safety">Data Governance & Turnover Completion</h3>
        <div className="space-y-2 text-sm text-slate-200">
          <p>
            <span className="font-semibold text-slate-100">Metadata ownership:</span> updates to core tag metadata in active jobs should be controlled and reviewed,
            since changes affect future jobs and reports.
          </p>
          <p>
            <span className="font-semibold text-slate-100">Turnover complete when:</span> all steps are resolved, required evidence is attached, signature is saved,
            export is generated, and ZIP backup is stored off-device.
          </p>
        </div>
      </article>

      <article className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="text-base font-semibold text-safety">Failure-Mode Playbooks</h3>
        <div className="space-y-2 text-sm text-slate-200">
          <p>
            <span className="font-semibold text-slate-100">Scanner fails:</span> verify permissions, close/reopen scanner, manually navigate to Tags, and continue with
            manual lookup if needed.
          </p>
          <p>
            <span className="font-semibold text-slate-100">CSV import fails:</span> validate headers and row completeness, then re-import using template format.
          </p>
          <p>
            <span className="font-semibold text-slate-100">PDF/BYOF export fails:</span> verify required fields and signature are present, then retry export and save ZIP
            backup prior to escalation.
          </p>
        </div>
      </article>

      <article className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="text-base font-semibold text-safety">Shift Handover Notes</h3>
        <p className="text-sm text-slate-200">Use this structure at shift change to keep loop package continuity and avoid repeated field work.</p>
        <div className="rounded-lg border border-slate-600 bg-slate-900 p-3 text-sm text-slate-200">
          <p>Unit/Area:</p>
          <p>Shift Window:</p>
          <p>Completed Tags/Jobs:</p>
          <p>Open Tags/Jobs (with status):</p>
          <p>Blocked Items / Permits / Access Issues:</p>
          <p>Evidence Gaps to Capture Next Shift:</p>
          <p>Calibration Exceptions / Out-of-Tolerance Findings:</p>
          <p>Export & Backup Status (PDF + ZIP):</p>
          <p>Priority Start List for Next Shift:</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <a className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-safety px-4 py-3 text-sm font-bold text-black" download href="/shift-handover-template.txt">
            Download TXT Template
          </a>
          <a className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900" download href="/shift-handover-template.csv">
            Download CSV Template
          </a>
        </div>

        <Link className="inline-flex min-h-[44px] items-center rounded-lg bg-safety px-4 py-3 text-sm font-bold text-black" to="/handover">
          Open In-App Handover (Tech/Lead)
        </Link>

        <div className="space-y-2 rounded-lg border border-slate-600 bg-slate-900 p-3">
          <p className="text-sm font-semibold text-slate-100">Use Your Own Form</p>
          <p className="text-xs text-slate-300">Upload a custom TXT/CSV/MD handover form. LoopVault keeps it offline on this device for reuse.</p>

          <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
            Upload Custom Form
            <input accept=".txt,.csv,.md,text/plain,text/csv,text/markdown" className="hidden" onChange={(event) => void onCustomTemplateSelected(event)} type="file" />
          </label>

          <div className="flex flex-wrap gap-2">
            <button className="min-h-[44px] rounded-lg bg-safety px-4 py-2 text-sm font-bold text-black" onClick={onDownloadCustomTemplate} type="button">
              Download Saved Custom Form
            </button>
            <button className="min-h-[44px] rounded-lg border border-slate-400 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900" onClick={onClearCustomTemplate} type="button">
              Clear Saved Form
            </button>
          </div>

          {customTemplateName ? <p className="text-xs text-slate-300">Saved form: {customTemplateName}</p> : null}
          {templateStatus ? <p className="text-xs text-slate-300">{templateStatus}</p> : null}
        </div>
      </article>
    </section>
  );
}
