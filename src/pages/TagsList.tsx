import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { db, type TagEntity } from '../db';

export function TagsList(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchText = searchParams.get('q') ?? '';

  const tags = useLiveQuery(async () => await db.tags.toArray(), [], []) as TagEntity[];

  const filteredTags = useMemo(() => {
    const normalized = searchText.trim().toLowerCase();
    if (!normalized) {
      return tags;
    }
    return tags.filter((tag) => {
      const numberMatch = tag.tagNumber.toLowerCase().includes(normalized);
      const descriptionMatch = tag.description.toLowerCase().includes(normalized);
      return numberMatch || descriptionMatch;
    });
  }, [searchText, tags]);

  const onSearchChange = (value: string): void => {
    const next = value.trim();
    if (next.length === 0) {
      setSearchParams({});
      return;
    }
    setSearchParams({ q: value });
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Tags</h2>
      <input
        className="w-full rounded-xl border border-slate-600 bg-slate-800 p-4 text-base"
        onInput={(event: { target: HTMLInputElement }) => onSearchChange(event.target.value)}
        placeholder="Search Tags"
        value={searchText}
      />

      <ul className="space-y-2">
        {filteredTags.length === 0 ? <li className="rounded-lg border border-slate-700 p-3 text-sm text-slate-300">No tags found.</li> : null}
        {filteredTags.map((tag) => (
          <li key={tag.tagNumber}>
            <Link
              className="block rounded-lg border border-slate-700 bg-slate-800 p-4 text-base"
              to={`/tags/${encodeURIComponent(tag.tagNumber)}${searchText ? `?q=${encodeURIComponent(searchText)}` : ''}`}
            >
              <p className="text-lg font-semibold text-safety">{tag.tagNumber}</p>
              <p className="text-sm text-slate-200">{tag.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
