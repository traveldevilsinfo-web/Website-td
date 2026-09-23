"use client";

import { useEffect, useRef, useState } from "react";
import { btnGhost, btnPrimary, input } from "./ui";

export type MediaItem = { id: number; url: string; filename: string; mime: string; alt: string | null };

const postJson = async (url: string, body: unknown) => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return data;
};

/** Sends the file straight to storage (signed URL) and returns its storage path. Not yet in the media library. */
export async function putFile(file: File): Promise<string> {
  const { path, mime, uploadUrl } = await postJson("/api/admin/upload", { name: file.name, size: file.size });
  const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": mime }, body: file });
  if (!res.ok) throw new Error(`${file.name}: upload failed (${res.status})`);
  return path;
}

export async function uploadFiles(files: FileList | File[]): Promise<{ saved: MediaItem[]; errors: string[] }> {
  const saved: MediaItem[] = [], errors: string[] = [];
  for (const f of Array.from(files)) {
    try {
      saved.push(await postJson("/api/admin/media", { path: await putFile(f), filename: f.name }));
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  return { saved, errors };
}

/** Modal library: search, upload, pick one or many. */
export function MediaPicker({ multiple, onPick, onClose }: { multiple?: boolean; onPick: (urls: string[]) => void; onClose: () => void }) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const fetchMedia = (query: string) => fetch(`/api/admin/media?q=${encodeURIComponent(query)}`).then((r) => r.json());
  const load = async (query: string) => setItems(await fetchMedia(query));
  useEffect(() => {
    fetchMedia("").then(setItems);
  }, []);

  const toggle = (url: string) =>
    multiple ? setSel(sel.includes(url) ? sel.filter((u) => u !== url) : [...sel, url]) : onPick([url]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label="Media library" className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-lg bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), load(q))}
            placeholder="Search files…" className={`${input} max-w-xs`} />
          <label className={`${btnGhost} cursor-pointer`}>
            {busy ? "Uploading…" : "Upload"}
            <input type="file" multiple accept="image/*,video/mp4,application/pdf" className="hidden" onChange={async (e) => {
              if (!e.target.files?.length) return;
              setBusy(true);
              const r = await uploadFiles(e.target.files);
              setBusy(false);
              setErr(r.errors?.join(", ") ?? "");
              setItems([...(r.saved ?? []), ...(items ?? [])]);
            }} />
          </label>
          {err && <span className="text-xs text-red-600">{err}</span>}
          <button type="button" onClick={onClose} className="ml-auto px-2 text-xl text-gray-500" aria-label="Close">×</button>
        </div>
        <div className="grid flex-1 grid-cols-3 gap-2 overflow-y-auto p-3 sm:grid-cols-5">
          {items === null && <p className="col-span-full p-6 text-center text-sm text-gray-500">Loading…</p>}
          {items?.length === 0 && <p className="col-span-full p-6 text-center text-sm text-gray-500">No files. Upload some.</p>}
          {items?.map((m) => (
            <button type="button" key={m.id} onClick={() => toggle(m.url)} title={m.filename}
              className={`relative aspect-square overflow-hidden rounded border-2 bg-gray-100 ${sel.includes(m.url) ? "border-brand" : "border-transparent"}`}>
              {m.mime.startsWith("image/")
                ? <img src={m.url} alt={m.alt ?? ""} loading="lazy" className="size-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                : <span className="p-2 text-xs break-all">{m.filename}</span>}
            </button>
          ))}
        </div>
        {multiple && (
          <div className="flex justify-end gap-2 border-t p-3">
            <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
            <button type="button" disabled={!sel.length} onClick={() => onPick(sel)} className={btnPrimary}>Add {sel.length || ""} selected</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Single image URL field with preview + library picker. */
export function ImageField({ name, initial }: { name: string; initial?: string | null }) {
  const [url, setUrl] = useState(initial ?? "");
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-start gap-3">
      <div className="size-24 shrink-0 overflow-hidden rounded border bg-gray-100">
        {url && <img src={url} alt="" className="size-full object-cover" />}{/* eslint-disable-line @next/next/no-img-element */}
      </div>
      <div className="flex-1 space-y-2">
        <input name={name} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Image URL" className={input} />
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(true)} className={btnGhost}>Choose / upload</button>
          {url && <button type="button" onClick={() => setUrl("")} className="text-sm text-red-600">Remove</button>}
        </div>
      </div>
      {open && <MediaPicker onClose={() => setOpen(false)} onPick={([u]) => { setUrl(u); setOpen(false); }} />}
    </div>
  );
}

/** Ordered image list (gallery). Posts newline-separated URLs. */
export function GalleryField({ name, initial }: { name: string; initial: string[] }) {
  const [urls, setUrls] = useState(initial);
  const [open, setOpen] = useState(false);
  const drag = useRef<number | null>(null);
  return (
    <div>
      <input type="hidden" name={name} value={urls.join("\n")} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {urls.map((u, i) => (
          <div key={u + i} draggable onDragStart={() => (drag.current = i)} onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag.current === null || drag.current === i) return;
              const next = [...urls];
              next.splice(i, 0, next.splice(drag.current, 1)[0]);
              setUrls(next);
            }}
            className="group relative aspect-square cursor-move overflow-hidden rounded border bg-gray-100">
            <img src={u} alt="" className="size-full object-cover" />{/* eslint-disable-line @next/next/no-img-element */}
            <button type="button" onClick={() => setUrls(urls.filter((_, j) => j !== i))} aria-label="Remove image"
              className="absolute right-1 top-1 rounded bg-white/90 px-1.5 text-xs text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => setOpen(true)} className="aspect-square rounded border-2 border-dashed text-sm text-gray-500 hover:border-brand hover:text-brand">+ Add</button>
      </div>
      <p className="mt-1 text-xs text-gray-500">Drag to reorder. First image is used as the hero on the trip page.</p>
      {open && <MediaPicker multiple onClose={() => setOpen(false)} onPick={(u) => { setUrls([...urls, ...u]); setOpen(false); }} />}
    </div>
  );
}
