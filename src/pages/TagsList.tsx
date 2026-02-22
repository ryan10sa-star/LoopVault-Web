import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { StatusChip } from '../components/StatusChip';
import { db, type JobEntity, type StepEntity, type TagEntity } from '../db';

type LookupMode = 'tag' | 'unit' | 'plant';

export function TagsList(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawMode = searchParams.get('mode');
  const mode: LookupMode = rawMode === 'unit' || rawMode === 'plant' ? rawMode : 'tag';
  const searchText = searchParams.get('q') ?? '';
  const selectedUnit = searchParams.get('unit') ?? '';
  const selectedPlant = searchParams.get('plant') ?? '';
  const selectedType = searchParams.get('type') ?? '';

  const tags = useLiveQuery(async () => await db.tags.toArray(), [], []) as TagEntity[];
  const jobs = useLiveQuery(async () => await db.jobs.toArray(), [], []) as JobEntity[];
  const steps = useLiveQuery(async () => await db.steps.toArray(), [], []) as StepEntity[];

  const unitOptions = useMemo(() => {
    return [...new Set(tags.map((tag) => tag.unit.trim()).filter((unit) => unit.length > 0))].sort((left, right) => left.localeCompare(right));
  }, [tags]);

  const plantOptions = useMemo(() => {
    return [...new Set(tags.map((tag) => tag.plant.trim()).filter((plant) => plant.length > 0))].sort((left, right) => left.localeCompare(right));
  }, [tags]);

  const plantScopedUnitOptions = useMemo(() => {
    const scoped = selectedPlant ? tags.filter((tag) => tag.plant.trim() === selectedPlant) : tags;
    return [...new Set(scoped.map((tag) => tag.unit.trim()).filter((unit) => unit.length > 0))].sort((left, right) => left.localeCompare(right));
  }, [selectedPlant, tags]);

  const typeOptions = useMemo(() => {
    return [...new Set(tags.map((tag) => (tag.type?.trim() || inferTagType(tag.tagNumber))).filter((type) => type.length > 0))].sort((left, right) => left.localeCompare(right));
  }, [tags]);

  const filteredTags = useMemo(() => {
    if (mode === 'tag') {
      const normalized = searchText.trim().toLowerCase();
      if (!normalized) {
        return applyTypeFilter(tags, selectedType);
      }
      return applyTypeFilter(tags, selectedType).filter((tag) => {
        const numberMatch = tag.tagNumber.toLowerCase().includes(normalized);
        const descriptionMatch = tag.description.toLowerCase().includes(normalized);
        return numberMatch || descriptionMatch;
      });
    }

    if (mode === 'unit') {
      if (!selectedUnit) {
        return applyTypeFilter(tags, selectedType);
      }
      return applyTypeFilter(tags, selectedType).filter((tag) => tag.unit.trim() === selectedUnit);
    }

    if (!selectedPlant) {
      return applyTypeFilter(tags, selectedType);
    }
    return applyTypeFilter(tags, selectedType).filter((tag) => {
      if (tag.plant.trim() !== selectedPlant) {
        return false;
      }
      if (!selectedUnit) {
        return true;
      }
      return tag.unit.trim() === selectedUnit;
    });
  }, [mode, searchText, selectedPlant, selectedType, selectedUnit, tags]);

  const buildParams = (overrides: Partial<Record<'mode' | 'q' | 'unit' | 'plant' | 'type', string>>): Record<string, string> => {
    const next: Record<string, string> = {};
    const nextMode = overrides.mode ?? mode;
    const nextQuery = overrides.q ?? searchText;
    const nextUnit = overrides.unit ?? selectedUnit;
    const nextPlant = overrides.plant ?? selectedPlant;
    const nextType = overrides.type ?? selectedType;

    if (nextMode) {
      next.mode = nextMode;
    }
    if (nextQuery.trim()) {
      next.q = nextQuery;
    }
    if (nextUnit.trim()) {
      next.unit = nextUnit;
    }
    if (nextPlant.trim()) {
      next.plant = nextPlant;
    }
    if (nextType.trim()) {
      next.type = nextType;
    }

    return next;
  };

  const onModeChange = (nextMode: LookupMode): void => {
    if (nextMode === 'tag') {
      setSearchParams(buildParams({ mode: 'tag', unit: '', plant: '' }));
      return;
    }
    if (nextMode === 'unit') {
      const nextUnit = unitOptions[0] ?? '';
      setSearchParams(buildParams({ mode: 'unit', unit: nextUnit, q: '', plant: '' }));
      return;
    }
    const nextPlant = plantOptions[0] ?? '';
    setSearchParams(buildParams({ mode: 'plant', plant: nextPlant, q: '', unit: '' }));
  };

  const onSearchChange = (value: string): void => {
    const next = value.trim();
    if (next.length === 0) {
      setSearchParams(buildParams({ mode: 'tag', q: '' }));
      return;
    }
    setSearchParams(buildParams({ mode: 'tag', q: value }));
  };

  const onUnitChange = (value: string): void => {
    if (!value) {
      setSearchParams(buildParams({ mode: 'unit', unit: '' }));
      return;
    }
    setSearchParams(buildParams({ mode: 'unit', unit: value }));
  };

  const onPlantChange = (value: string): void => {
    if (!value) {
      setSearchParams(buildParams({ mode: 'plant', plant: '', unit: '' }));
      return;
    }
    setSearchParams(buildParams({ mode: 'plant', plant: value, unit: '' }));
  };

  const onPlantUnitChange = (value: string): void => {
    if (!selectedPlant) {
      setSearchParams(buildParams({ mode: 'plant', plant: '', unit: '' }));
      return;
    }
    if (!value) {
      setSearchParams(buildParams({ mode: 'plant', plant: selectedPlant, unit: '' }));
      return;
    }
    setSearchParams(buildParams({ mode: 'plant', plant: selectedPlant, unit: value }));
  };

  const onTypeChange = (value: string): void => {
    if (!value) {
      setSearchParams(buildParams({ type: '' }));
      return;
    }
    setSearchParams(buildParams({ type: value }));
  };

  const detailQuery = useMemo(() => {
    if (mode === 'tag') {
      if (!searchText) {
        return selectedType ? `?mode=tag&type=${encodeURIComponent(selectedType)}` : '?mode=tag';
      }
      const base = `?mode=tag&q=${encodeURIComponent(searchText)}`;
      return selectedType ? `${base}&type=${encodeURIComponent(selectedType)}` : base;
    }
    if (mode === 'unit') {
      const base = selectedUnit ? `?mode=unit&unit=${encodeURIComponent(selectedUnit)}` : '?mode=unit';
      return selectedType ? `${base}&type=${encodeURIComponent(selectedType)}` : base;
    }
    if (!selectedPlant) {
      return selectedType ? `?mode=plant&type=${encodeURIComponent(selectedType)}` : '?mode=plant';
    }
    if (!selectedUnit) {
      const base = `?mode=plant&plant=${encodeURIComponent(selectedPlant)}`;
      return selectedType ? `${base}&type=${encodeURIComponent(selectedType)}` : base;
    }
    const base = `?mode=plant&plant=${encodeURIComponent(selectedPlant)}&unit=${encodeURIComponent(selectedUnit)}`;
    return selectedType ? `${base}&type=${encodeURIComponent(selectedType)}` : base;
  }, [mode, searchText, selectedPlant, selectedType, selectedUnit]);

  const summaryText = useMemo(() => {
    if (mode === 'tag') {
      const scope = searchText ? `Tag search: ${searchText}` : 'All tags';
      const typeScope = selectedType ? ` • Type: ${selectedType}` : '';
      return `${scope}${typeScope} • ${filteredTags.length} tag(s)`;
    }
    if (mode === 'unit') {
      const scope = selectedUnit ? `Unit: ${selectedUnit}` : 'All units';
      const typeScope = selectedType ? ` • Type: ${selectedType}` : '';
      return `${scope}${typeScope} • ${filteredTags.length} tag(s)`;
    }
    if (!selectedPlant) {
      const typeScope = selectedType ? ` • Type: ${selectedType}` : '';
      return `All plants${typeScope} • ${filteredTags.length} tag(s)`;
    }
    if (!selectedUnit) {
      const typeScope = selectedType ? ` • Type: ${selectedType}` : '';
      return `Plant: ${selectedPlant}${typeScope} • ${filteredTags.length} tag(s)`;
    }
    const typeScope = selectedType ? ` • Type: ${selectedType}` : '';
    return `Plant: ${selectedPlant} • Unit: ${selectedUnit}${typeScope} • ${filteredTags.length} tag(s)`;
  }, [filteredTags.length, mode, searchText, selectedPlant, selectedType, selectedUnit]);

  const tagStatusMap = useMemo(() => {
    const jobsByTag = new Map<number, JobEntity[]>();
    jobs.forEach((job) => {
      jobsByTag.set(job.tagId, [...(jobsByTag.get(job.tagId) ?? []), job]);
    });

    const stepsByJob = new Map<number, StepEntity[]>();
    steps.forEach((step) => {
      stepsByJob.set(step.jobId, [...(stepsByJob.get(step.jobId) ?? []), step]);
    });

    const map = new Map<string, TagCardStatus>();
    filteredTags.forEach((tag) => {
      const tagId = tag.id;
      if (typeof tagId !== 'number') {
        map.set(tag.tagNumber, { label: 'No Jobs', tone: 'slate', priority: 2, isException: false });
        return;
      }

      const tagJobs = jobsByTag.get(tagId) ?? [];
      if (tagJobs.length === 0) {
        map.set(tag.tagNumber, { label: 'No Jobs', tone: 'slate', priority: 2, isException: false });
        return;
      }

      const hasFail = tagJobs.some((job) => (stepsByJob.get(job.id as number) ?? []).some((step) => step.passFail === 'fail'));
      if (hasFail) {
        map.set(tag.tagNumber, { label: 'Exceptions', tone: 'red', priority: 0, isException: true });
        return;
      }

      const hasInProgress = tagJobs.some((job) => job.status === 'in-progress');
      if (hasInProgress) {
        const inProgressJob = [...tagJobs].sort((left, right) => (right.id ?? 0) - (left.id ?? 0)).find((job) => job.status === 'in-progress');
        map.set(tag.tagNumber, { label: 'In Progress', tone: 'amber', priority: 1, isException: false, activeJobId: inProgressJob?.id });
        return;
      }

      const hasSuspended = tagJobs.some((job) => job.status === 'suspended');
      if (hasSuspended) {
        map.set(tag.tagNumber, { label: 'Suspended', tone: 'amber-dark', priority: 2, isException: false });
        return;
      }

      const hasCancelled = tagJobs.some((job) => job.status === 'cancelled');
      if (hasCancelled) {
        map.set(tag.tagNumber, { label: 'Cancelled', tone: 'slate', priority: 4, isException: false });
        return;
      }

      map.set(tag.tagNumber, { label: 'Completed', tone: 'emerald', priority: 3, isException: false });
    });

    return map;
  }, [filteredTags, jobs, steps]);

  const sortedTags = useMemo(() => {
    return [...filteredTags].sort((left, right) => {
      const leftStatus = tagStatusMap.get(left.tagNumber)?.priority ?? 99;
      const rightStatus = tagStatusMap.get(right.tagNumber)?.priority ?? 99;
      if (leftStatus !== rightStatus) {
        return leftStatus - rightStatus;
      }
      return left.tagNumber.localeCompare(right.tagNumber);
    });
  }, [filteredTags, tagStatusMap]);

  const exceptionTags = useMemo(() => {
    return sortedTags.filter((tag) => tagStatusMap.get(tag.tagNumber)?.isException).slice(0, 5);
  }, [sortedTags, tagStatusMap]);

  return (
    <section className="lv-page">
      <header className="lv-panel">
        <h2 className="lv-title">Tags</h2>
        <p className="lv-subtitle">Search and triage by tag, unit, or plant with live status context.</p>
      </header>

      <div className="lv-panel grid grid-cols-3 gap-2">
        <button
          className={`min-h-[44px] rounded-xl px-3 py-2 text-sm font-bold ${mode === 'tag' ? 'bg-safety text-black' : 'bg-slate-100 text-slate-900'}`}
          onClick={() => onModeChange('tag')}
          type="button"
        >
          Tag
        </button>
        <button
          className={`min-h-[44px] rounded-lg px-3 py-2 text-sm font-bold ${mode === 'unit' ? 'bg-safety text-black' : 'bg-slate-100 text-slate-900'}`}
          onClick={() => onModeChange('unit')}
          type="button"
        >
          Unit
        </button>
        <button
          className={`min-h-[44px] rounded-lg px-3 py-2 text-sm font-bold ${mode === 'plant' ? 'bg-safety text-black' : 'bg-slate-100 text-slate-900'}`}
          onClick={() => onModeChange('plant')}
          type="button"
        >
          Plant
        </button>
      </div>

      {mode === 'tag' ? (
        <input
          className="lv-input"
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          placeholder="Search by tag number or description"
          value={searchText}
        />
      ) : null}

      <select className="lv-input" onChange={(event) => onTypeChange(event.currentTarget.value)} value={selectedType}>
        <option value="">All Types</option>
        {typeOptions.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      {typeOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            className={`min-h-[44px] rounded-xl px-3 py-2 text-sm font-bold ${selectedType === '' ? 'bg-safety text-black' : 'bg-slate-100 text-slate-900'}`}
            onClick={() => onTypeChange('')}
            type="button"
          >
            All
          </button>
          {typeOptions.slice(0, 8).map((type) => (
            <button
              className={`min-h-[44px] rounded-xl px-3 py-2 text-sm font-bold ${selectedType === type ? 'bg-safety text-black' : 'bg-slate-100 text-slate-900'}`}
              key={type}
              onClick={() => onTypeChange(type)}
              type="button"
            >
              {type}
            </button>
          ))}
        </div>
      ) : null}

      {mode === 'unit' ? (
        <select
          className="lv-input"
          onChange={(event) => onUnitChange(event.currentTarget.value)}
          value={selectedUnit}
        >
          <option value="">All Units</option>
          {unitOptions.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      ) : null}

      {mode === 'plant' ? (
        <div className="grid gap-2">
          <select
            className="lv-input"
            onChange={(event) => onPlantChange(event.currentTarget.value)}
            value={selectedPlant}
          >
            <option value="">All Plants</option>
            {plantOptions.map((plant) => (
              <option key={plant} value={plant}>
                {plant}
              </option>
            ))}
          </select>

          <select
            className="lv-input"
            disabled={!selectedPlant}
            onChange={(event) => onPlantUnitChange(event.currentTarget.value)}
            value={selectedPlant ? selectedUnit : ''}
          >
            <option value="">All Units in Plant</option>
            {plantScopedUnitOptions.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <p className="lv-panel-quiet text-sm text-slate-200">{summaryText}</p>

      {exceptionTags.length > 0 ? (
        <section className="lv-panel space-y-2 border-red-500 bg-red-950/30">
          <p className="text-sm font-semibold text-red-200">Exception Spotlight</p>
          <ul className="space-y-1">
            {exceptionTags.map((tag) => (
              <li key={`exception-${tag.tagNumber}`}>
                <Link className="text-sm font-semibold text-red-100 underline" to={`/tags/${encodeURIComponent(tag.tagNumber)}${detailQuery}`}>
                  {tag.tagNumber} — {tag.description || 'No description'}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ul className="space-y-2">
        {sortedTags.length === 0 ? <li className="rounded-lg border border-slate-700 p-3 text-sm text-slate-300">No tags found.</li> : null}
        {sortedTags.map((tag) => (
          <li key={tag.tagNumber}>
            <div
              className="block min-h-[44px] rounded-xl border border-slate-500 bg-slate-100 p-4 text-base shadow-sm"
              onClick={() => navigate(`/tags/${encodeURIComponent(tag.tagNumber)}${detailQuery}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(`/tags/${encodeURIComponent(tag.tagNumber)}${detailQuery}`);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-lg font-semibold text-safety">{tag.tagNumber}</p>
                <StatusBadge
                  status={tagStatusMap.get(tag.tagNumber)}
                  onOpenJob={(jobId) => {
                    navigate(`/jobs/${jobId}`);
                  }}
                />
              </div>
              <p className="text-sm text-slate-800">{tag.description}</p>
              <p className="mt-1 text-xs text-slate-700">Type: {tag.type || inferTagType(tag.tagNumber) || '-'} • Plant: {tag.plant || '-'} • Unit: {tag.unit || '-'}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface TagCardStatus {
  label: 'No Jobs' | 'In Progress' | 'Suspended' | 'Cancelled' | 'Completed' | 'Exceptions';
  tone: 'slate' | 'amber' | 'amber-dark' | 'emerald' | 'red';
  priority: number;
  isException: boolean;
  activeJobId?: number;
}

function StatusBadge(props: { status: TagCardStatus | undefined; onOpenJob: (jobId: number) => void }): JSX.Element {
  const status = props.status;
  if (!status) {
    return <StatusChip label="Unknown" tone="neutral" />;
  }
  const tone =
    status.tone === 'red'
      ? 'danger'
      : status.tone === 'amber'
        ? 'caution'
        : status.tone === 'amber-dark'
          ? 'warning'
          : status.tone === 'emerald'
            ? 'success'
            : 'neutral';

  if (status.label === 'In Progress' && typeof status.activeJobId === 'number') {
    return (
      <StatusChip
        label={status.label}
        onClick={() => props.onOpenJob(status.activeJobId as number)}
        tone={tone}
      />
    );
  }

  return <StatusChip label={status.label} tone={tone} />;
}

function inferTagType(tagNumber: string): string {
  const inferred = tagNumber.trim().match(/^[A-Za-z]+/)?.[0] ?? '';
  return inferred.toUpperCase();
}

function applyTypeFilter(tags: TagEntity[], selectedType: string): TagEntity[] {
  if (!selectedType) {
    return tags;
  }
  return tags.filter((tag) => (tag.type?.trim() || inferTagType(tag.tagNumber)) === selectedType);
}
