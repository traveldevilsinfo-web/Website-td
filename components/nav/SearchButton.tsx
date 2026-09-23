"use client";

import { Search } from "lucide-react";
import { useRef } from "react";

/** Icon button → search dialog (GET /search?q=). */
export function SearchButton({ suggestions }: { suggestions: { label: string; href: string }[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" aria-label="Search trips" onClick={() => { ref.current?.showModal(); ref.current?.querySelector("input")?.focus(); }}
        className="press grid size-10 place-items-center rounded-full bg-brand text-white shadow-md shadow-brand/25 hover:bg-brand-dark">
        <Search className="size-[18px]" strokeWidth={2.5} />
      </button>
      <dialog ref={ref} aria-label="Search" className="mx-auto mt-24 w-[calc(100%-2rem)] max-w-xl rounded-3xl p-0 shadow-2xl"
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}>
        <form action="/search" className="flex items-center gap-3 border-b border-line p-4">
          <Search className="size-5 text-muted" aria-hidden />
          <input name="q" placeholder="Where do you want to go?" autoComplete="off" className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none" />
          <button className="press rounded-full bg-brand px-5 py-2 text-sm font-extrabold text-white">Search</button>
        </form>
        {suggestions.length > 0 && (
          <div className="p-4">
            <p className="eyebrow mb-3 text-muted">Popular</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <a key={s.href} href={s.href} className="press rounded-full bg-surface px-4 py-2 text-sm font-bold hover:bg-line">{s.label}</a>
              ))}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
