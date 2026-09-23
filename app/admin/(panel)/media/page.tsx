import { desc, ilike } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { PageHeader, input } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/SaveForm";
import { deleteMedia, updateMediaAlt } from "../admin-actions";
import { UploadButton } from "./UploadButton";

export default async function MediaPage({ searchParams }: PageProps<"/admin/media">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const rows = await db.select().from(t.media).where(query ? ilike(t.media.filename, `%${query}%`) : undefined).orderBy(desc(t.media.createdAt)).limit(300);
  return (
    <>
      <PageHeader title="Media library" action={<UploadButton />} />
      <form className="mb-4"><input name="q" defaultValue={query} placeholder="Search by filename…" className={`${input} max-w-xs`} /></form>
      {!rows.length && <p className="rounded-lg border bg-white p-8 text-center text-sm text-gray-500">No files yet.</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((m) => (
          <div key={m.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <a href={m.url} target="_blank" className="block aspect-video bg-gray-100">
              {m.mime.startsWith("image/")
                ? <img src={m.url} alt={m.alt ?? ""} loading="lazy" className="size-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                : <span className="grid size-full place-items-center p-2 text-xs text-gray-500">{m.mime}</span>}
            </a>
            <div className="space-y-2 p-2 text-xs">
              <p className="truncate font-medium" title={m.filename}>{m.filename}</p>
              <p className="truncate text-gray-500">{(m.size / 1024).toFixed(0)} KB · <code>{m.url}</code></p>
              <form action={updateMediaAlt.bind(null, m.id)} className="flex gap-1">
                <input name="alt" defaultValue={m.alt ?? ""} placeholder="Alt text" className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1" />
                <button className="rounded border border-gray-300 px-2">Save</button>
              </form>
              <form action={deleteMedia.bind(null, m.id)}><ConfirmButton message="Delete this file? Pages using it will show a broken image.">Delete</ConfirmButton></form>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
