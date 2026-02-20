import { useSearchParams } from 'react-router-dom';

export function NewTag(): JSX.Element {
  const [params] = useSearchParams();
  const suggestedTag = params.get('tagNumber') ?? '';

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Create Tag</h2>
      <p className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-slate-200">Tag not found in local database.</p>
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        <p className="text-sm text-slate-300">Suggested tag number from scan:</p>
        <p className="text-xl font-bold text-safety">{suggestedTag || 'N/A'}</p>
      </div>
      <p className="text-sm text-slate-300">Tag creation form can be added in the next task.</p>
    </section>
  );
}
