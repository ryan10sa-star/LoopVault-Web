import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createTag, getTagByNumber, type TagEntity } from '../db';

export function NewTag(): JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const suggestedTag = params.get('tagNumber') ?? '';
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [form, setForm] = useState<TagEntity>({
    tagNumber: suggestedTag,
    type: inferTagType(suggestedTag),
    plant: '',
    instrumentRole: '',
    safetyLayer: '',
    votingLogic: '',
    controlSystem: '',
    silTarget: '',
    proofTestInterval: '',
    bypassPermitRequired: '',
    functionalOwner: '',
    description: '',
    area: '',
    unit: '',
    service: '',
    lrv: '',
    urv: '',
    engUnit: '',
    transferFunction: '',
    failSafe: '',
    maxError: '',
    testEquipment: '',
    testEquipmentCalDate: ''
  });

  const onFieldChange = (field: keyof TagEntity, value: string): void => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const onSave = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const payload: TagEntity = {
      ...form,
      tagNumber: form.tagNumber.trim(),
      type: (form.type.trim() || inferTagType(form.tagNumber)).toUpperCase(),
      plant: form.plant.trim(),
      instrumentRole: form.instrumentRole.trim(),
      safetyLayer: form.safetyLayer.trim(),
      votingLogic: form.votingLogic.trim(),
      controlSystem: form.controlSystem.trim(),
      silTarget: form.silTarget.trim().toUpperCase(),
      proofTestInterval: form.proofTestInterval.trim(),
      bypassPermitRequired: form.bypassPermitRequired.trim(),
      functionalOwner: form.functionalOwner.trim(),
      description: form.description.trim(),
      area: form.area.trim(),
      unit: form.unit.trim(),
      service: form.service.trim(),
      lrv: form.lrv.trim(),
      urv: form.urv.trim(),
      engUnit: form.engUnit.trim(),
      transferFunction: form.transferFunction.trim(),
      failSafe: form.failSafe.trim(),
      maxError: form.maxError.trim(),
      testEquipment: form.testEquipment.trim(),
      testEquipmentCalDate: form.testEquipmentCalDate.trim()
    };

    if (!payload.tagNumber || !payload.description || !payload.area || !payload.unit || !payload.service) {
      setError('Tag Number, Description, Area, Unit, and Service are required.');
      setStatus('');
      return;
    }

    try {
      const existing = await getTagByNumber(payload.tagNumber);
      if (existing) {
        setError('That tag number already exists. Opening existing tag.');
        setStatus('');
        navigate(`/tags/${encodeURIComponent(payload.tagNumber)}`);
        return;
      }

      await createTag(payload);
      setStatus('Tag created successfully. Redirecting...');
      setError('');
      navigate(`/tags/${encodeURIComponent(payload.tagNumber)}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? `Failed to create tag: ${saveError.message}` : 'Failed to create tag.');
      setStatus('');
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Create Tag</h2>
      <p className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-slate-200">Tag not found in local database.</p>
      {status ? <p className="rounded-lg border border-emerald-400 bg-emerald-950 p-3 text-sm font-semibold text-emerald-100">✓ {status}</p> : null}
      {error ? <p className="rounded-lg border border-red-500 bg-red-950 p-3 text-sm">{error}</p> : null}

      <form className="space-y-3" onSubmit={(event) => void onSave(event)}>
        <label className="block">
          <span className="text-sm text-slate-300">Tag Number *</span>
          <input className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900" onChange={(event) => onFieldChange('tagNumber', event.currentTarget.value)} type="text" value={form.tagNumber} />
        </label>
        <label className="block">
          <span className="text-sm text-slate-300">Type</span>
          <input className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900" onChange={(event) => onFieldChange('type', event.currentTarget.value.toUpperCase())} type="text" value={form.type} />
        </label>
        <label className="block">
          <span className="text-sm text-slate-300">Description *</span>
          <input className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900" onChange={(event) => onFieldChange('description', event.currentTarget.value)} type="text" value={form.description} />
        </label>
        <label className="block">
          <span className="text-sm text-slate-300">Plant</span>
          <input className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900" onChange={(event) => onFieldChange('plant', event.currentTarget.value)} type="text" value={form.plant} />
        </label>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <label className="block">
            <span className="text-sm text-slate-300">Instrument Role</span>
            <input
              className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900"
              onChange={(event) => onFieldChange('instrumentRole', event.currentTarget.value)}
              placeholder="Control / Indicator / Alarm"
              type="text"
              value={form.instrumentRole}
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">Safety Layer</span>
            <input
              className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900"
              onChange={(event) => onFieldChange('safetyLayer', event.currentTarget.value.toUpperCase())}
              placeholder="PIS / SIS / IPF / Shutdown"
              type="text"
              value={form.safetyLayer}
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">Voting Logic</span>
            <input
              className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900"
              onChange={(event) => onFieldChange('votingLogic', event.currentTarget.value)}
              placeholder="1oo1 / 2oo2 / 2oo3"
              type="text"
              value={form.votingLogic}
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">Control System</span>
            <input
              className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900"
              onChange={(event) => onFieldChange('controlSystem', event.currentTarget.value)}
              placeholder="Computer Control / PLC / DCS"
              type="text"
              value={form.controlSystem}
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">SIL Target</span>
            <input
              className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900"
              onChange={(event) => onFieldChange('silTarget', event.currentTarget.value.toUpperCase())}
              placeholder="SIL1 / SIL2 / SIL3"
              type="text"
              value={form.silTarget}
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">Proof Test Interval</span>
            <input
              className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900"
              onChange={(event) => onFieldChange('proofTestInterval', event.currentTarget.value)}
              placeholder="6 months / 12 months"
              type="text"
              value={form.proofTestInterval}
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">Bypass Permit Required</span>
            <input
              className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900"
              onChange={(event) => onFieldChange('bypassPermitRequired', event.currentTarget.value)}
              placeholder="Yes / No"
              type="text"
              value={form.bypassPermitRequired}
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">Functional Owner</span>
            <input
              className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900"
              onChange={(event) => onFieldChange('functionalOwner', event.currentTarget.value)}
              placeholder="Process Safety / Instrumentation"
              type="text"
              value={form.functionalOwner}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-sm text-slate-300">Area *</span>
            <input className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900" onChange={(event) => onFieldChange('area', event.currentTarget.value)} type="text" value={form.area} />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">Unit *</span>
            <input className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900" onChange={(event) => onFieldChange('unit', event.currentTarget.value)} type="text" value={form.unit} />
          </label>
        </div>
        <label className="block">
          <span className="text-sm text-slate-300">Service *</span>
          <input className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900" onChange={(event) => onFieldChange('service', event.currentTarget.value)} type="text" value={form.service} />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-sm text-slate-300">LRV</span>
            <input className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900" onChange={(event) => onFieldChange('lrv', event.currentTarget.value)} type="text" value={form.lrv} />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">URV</span>
            <input className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900" onChange={(event) => onFieldChange('urv', event.currentTarget.value)} type="text" value={form.urv} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-sm text-slate-300">Engineering Unit</span>
            <input className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900" onChange={(event) => onFieldChange('engUnit', event.currentTarget.value)} type="text" value={form.engUnit} />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">Transfer Function</span>
            <input className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900" onChange={(event) => onFieldChange('transferFunction', event.currentTarget.value)} type="text" value={form.transferFunction} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-sm text-slate-300">Fail Safe</span>
            <input className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900" onChange={(event) => onFieldChange('failSafe', event.currentTarget.value)} type="text" value={form.failSafe} />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">Max Error</span>
            <input className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900" onChange={(event) => onFieldChange('maxError', event.currentTarget.value)} type="text" value={form.maxError} />
          </label>
        </div>

        <label className="block">
          <span className="text-sm text-slate-300">Test Equipment</span>
          <input className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900" onChange={(event) => onFieldChange('testEquipment', event.currentTarget.value)} type="text" value={form.testEquipment} />
        </label>
        <label className="block">
          <span className="text-sm text-slate-300">Test Equipment Cal Due Date</span>
          <input className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-slate-100 p-3 text-base text-slate-900" onChange={(event) => onFieldChange('testEquipmentCalDate', event.currentTarget.value)} type="date" value={form.testEquipmentCalDate} />
        </label>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button className="min-h-14 rounded-xl bg-safety px-4 py-3 text-base font-bold text-black" type="submit">
            Save Tag
          </button>
          <button className="min-h-14 rounded-xl border border-slate-400 bg-slate-100 px-4 py-3 text-base font-semibold text-slate-900" onClick={() => navigate('/tags')} type="button">
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

function inferTagType(tagNumber: string): string {
  const inferred = tagNumber.trim().match(/^[A-Za-z]+/)?.[0] ?? '';
  return inferred.toUpperCase();
}
