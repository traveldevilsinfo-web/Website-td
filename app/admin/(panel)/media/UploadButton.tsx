"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadFiles } from "@/components/admin/Media";
import { btnPrimary } from "@/components/admin/ui";

export function UploadButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-sm text-red-600">{msg}</span>}
      <label className={`${btnPrimary} cursor-pointer`}>
        {busy ? "Uploading…" : "Upload files"}
        <input type="file" multiple accept="image/*,video/mp4,application/pdf" className="hidden" disabled={busy}
          onChange={async (e) => {
            if (!e.target.files?.length) return;
            setBusy(true);
            const r = await uploadFiles(e.target.files);
            setBusy(false);
            setMsg(r.errors?.join(", ") ?? "");
            e.target.value = "";
            router.refresh();
          }} />
      </label>
    </div>
  );
}
