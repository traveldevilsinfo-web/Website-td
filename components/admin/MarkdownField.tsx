"use client";

import { useRef, useState } from "react";
import { marked } from "marked";
import { MediaPicker } from "./Media";
import { input } from "./ui";

const tools: { label: string; title: string; wrap: [string, string] }[] = [
  { label: "B", title: "Bold", wrap: ["**", "**"] },
  { label: "I", title: "Italic", wrap: ["_", "_"] },
  { label: "H2", title: "Heading", wrap: ["\n## ", "\n"] },
  { label: "H3", title: "Sub-heading", wrap: ["\n### ", "\n"] },
  { label: "• List", title: "Bullet list", wrap: ["\n- ", ""] },
  { label: "Link", title: "Link", wrap: ["[", "](https://)"] },
];

/** Markdown textarea with a small toolbar, image insert and live preview. */
export function MarkdownField({ name, label, initial }: { name: string; label: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [preview, setPreview] = useState(false);
  const [picker, setPicker] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const insert = ([before, after]: [string, string]) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const next = value.slice(0, s) + before + value.slice(s, e) + after + value.slice(e);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, e + before.length);
    });
  };

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-1">
        <span className="mr-2 text-sm font-medium text-gray-700">{label}</span>
        {!preview && tools.map((t) => (
          <button key={t.label} type="button" title={t.title} onClick={() => insert(t.wrap)} className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs hover:bg-gray-100">{t.label}</button>
        ))}
        {!preview && <button type="button" onClick={() => setPicker(true)} className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs hover:bg-gray-100">Image</button>}
        <button type="button" onClick={() => setPreview(!preview)} className="ml-auto text-xs font-medium text-brand">{preview ? "Edit" : "Preview"}</button>
      </div>
      <input type="hidden" name={name} value={value} />
      {preview ? (
        <div className="prose-admin min-h-64 rounded-md border border-gray-300 bg-white p-4 text-sm" dangerouslySetInnerHTML={{ __html: marked.parse(value, { async: false }) }} />
      ) : (
        <textarea ref={ref} value={value} onChange={(e) => setValue(e.target.value)} rows={18} className={`${input} font-mono text-[13px] leading-relaxed`} />
      )}
      {picker && <MediaPicker onClose={() => setPicker(false)} onPick={([u]) => { setPicker(false); insert([`\n![](${u})\n`, ""]); }} />}
    </div>
  );
}
