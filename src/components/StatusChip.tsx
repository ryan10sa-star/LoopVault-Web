interface StatusChipProps {
  label: string;
  tone: 'neutral' | 'caution' | 'warning' | 'danger' | 'success';
  onClick?: () => void;
}

export function StatusChip(props: StatusChipProps): JSX.Element {
  const className =
    props.tone === 'danger'
      ? 'rounded-full border border-red-300/40 bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white'
      : props.tone === 'warning'
        ? 'rounded-full border border-amber-300/40 bg-amber-700 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white'
        : props.tone === 'caution'
          ? 'rounded-full border border-amber-200/50 bg-amber-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-black'
          : props.tone === 'success'
            ? 'rounded-full border border-emerald-300/40 bg-emerald-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white'
            : 'rounded-full border border-slate-400/40 bg-slate-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white';

  if (props.onClick) {
    return (
      <button className={`${className} cursor-pointer transition-all duration-150 hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-safety/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 active:translate-y-0`} onClick={props.onClick} type="button">
        {props.label}
      </button>
    );
  }

  return <span className={className}>{props.label}</span>;
}
