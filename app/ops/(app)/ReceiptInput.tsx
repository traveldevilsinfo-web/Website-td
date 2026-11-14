"use client";

import { useState } from "react";
import { Camera, FileText, X } from "lucide-react";

const fileUrl = (p: string) => `/api/ops/file?path=${encodeURIComponent(p)}`;

/** Photo/PDF of the bill → private bucket. The chosen path goes in a hidden `receiptPath` field. */
export function ReceiptInput({ defaultPath }: { defaultPath?: string | null }) {
  const [path, setPath] = useState(defaultPath ?? "");
  const [preview, setPreview] = useState<string | null>(null); // local copy right after upload: works before the expense is saved
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/ops/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, size: file.size }) });
      const plan = await res.json();
      if (!res.ok) throw new Error(plan.error ?? "Upload failed");
      const put = await fetch(plan.uploadUrl, { method: "PUT", headers: { "Content-Type": plan.mime }, body: file });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      setPath(plan.path);
      setPreview(URL.createObjectURL(file));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const isPdf = path.endsWith(".pdf");
  return (
    <div>
      <input type="hidden" name="receiptPath" value={path} />
      {path ? (
        <div className="flex items-center gap-3 rounded-md border border-[var(--line)] bg-white p-2">
          {isPdf ? <FileText className="size-10 text-[var(--muted)]" aria-hidden />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={preview ?? fileUrl(path)} alt="Receipt" className="size-16 rounded-lg object-cover" />}
          <a href={preview ?? fileUrl(path)} target="_blank" className="flex-1 text-sm font-semibold text-[var(--ink)] underline">{isPdf ? "PDF attached" : "View receipt"}</a>
          <button type="button" onClick={() => { setPath(""); setPreview(null); }} aria-label="Remove receipt" className="grid size-9 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--sunk)]"><X className="size-4" /></button>
        </div>
      ) : (
        <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-[color-mix(in_oklab,var(--ink)_20%,transparent)] bg-white px-4 py-5 text-sm font-semibold text-[var(--muted)] hover:border-zinc-400 ${busy ? "opacity-60" : ""}`}>
          <Camera className="size-5" aria-hidden /> {busy ? "Uploading…" : "Take photo or attach bill"}
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" disabled={busy}
            onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      )}
      {error && <p role="alert" className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
