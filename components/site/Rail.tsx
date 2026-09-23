"use client";

import { useEffect, useRef, useState } from "react";

/** Horizontal scroll-snap rail. Touch/trackpad use native momentum; arrows page by one viewport. */
export function Rail({ children, size = "card", label }: { children: React.ReactNode; size?: "card" | "wide" | "quote"; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const page = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.9, behavior: "smooth" });
  const arrow = "press grid size-11 place-items-center rounded-full border border-line bg-white shadow-sm transition-opacity disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className="relative mx-auto max-w-7xl">
      <div ref={ref} role="region" aria-label={label} tabIndex={0} data-size={size} className="rail gap-4 pb-6 pt-1 outline-none">
        {children}
      </div>
      <div className="hidden justify-end gap-2 px-4 md:flex">
        <button type="button" aria-label="Previous" disabled={edge.start} onClick={() => page(-1)} className={arrow}>←</button>
        <button type="button" aria-label="Next" disabled={edge.end} onClick={() => page(1)} className={arrow}>→</button>
      </div>
    </div>
  );
}
