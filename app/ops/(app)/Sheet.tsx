"use client";

import { useEffect, useRef } from "react";

/**
 * A bottom sheet you can actually grab.
 *
 * Follows Apple's fluid-interface rules (docs/superpowers/specs/2026-11-13-ops-v2-system.md §3):
 * the sheet tracks the finger 1:1 from wherever it was grabbed, resists past the top instead of
 * stopping dead, and on release it goes where the gesture was *heading* — the projected resting
 * point of the flick, not the nearest edge to the release point. Grabbing it mid-animation picks it
 * up from its live on-screen position, so nothing ever jumps.
 *
 * It only has to feel right, so the settle is a transition whose duration comes from the release
 * velocity rather than a full spring solver. ponytail: good enough by eye; swap in a spring if a
 * second gesture ever needs real velocity blending.
 */

/** Where a flick comes to rest, the way scroll deceleration does it (Designing Fluid Interfaces). */
const project = (v: number, decel = 0.998) => (v / 1000) * decel / (1 - decel);
/** The further past the edge you pull, the less it follows. Real things slow before they stop. */
const rubber = (over: number, size: number, c = 0.55) => (over * size * c) / (size + c * Math.abs(over));

export function Sheet({ label, onClose, head, foot, children }: {
  label: string; onClose: () => void; head: React.ReactNode; foot?: React.ReactNode; children: React.ReactNode;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLButtonElement>(null);
  const grab = useRef<{ id: number; from: number; y: number; samples: { t: number; y: number }[] } | null>(null);

  const paint = (y: number) => {
    const el = sheet.current;
    if (!el) return;
    el.style.transform = y ? `translate3d(0,${y}px,0)` : "none";
    if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - y / Math.max(1, el.offsetHeight)));
  };

  /** Read the position it is actually at right now — the presentation value, never the target. */
  const liveY = () => {
    const el = sheet.current;
    if (!el) return 0;
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform === "none" ? "" : getComputedStyle(el).transform);
    return m.m42;
  };

  const settle = (to: number, velocity: number, then?: () => void) => {
    const el = sheet.current;
    if (!el) return then?.();
    const gap = Math.abs(to - liveY());
    // A fast release should not then crawl: let the throw set the pace, within reason.
    const ms = Math.min(520, Math.max(170, velocity > 50 ? (gap / velocity) * 1000 + 120 : 340));
    el.style.transition = `transform ${ms}ms var(--ease-ios)`;
    if (scrim.current) scrim.current.style.transition = `opacity ${ms}ms var(--ease-ios)`;
    paint(to);
    if (then) window.setTimeout(then, ms);
  };

  const down = (e: React.PointerEvent) => {
    const el = sheet.current;
    if (!el || e.button !== 0) return;
    el.style.animation = "none"; // a grab during the entrance wins over it
    el.style.transition = "none"; // pick it up from where it is, mid-flight included
    if (scrim.current) scrim.current.style.transition = "none";
    try { el.setPointerCapture(e.pointerId); } catch { /* capture is a nicety; the drag still tracks without it */ }
    grab.current = { id: e.pointerId, from: e.clientY - liveY(), y: liveY(), samples: [{ t: performance.now(), y: e.clientY }] };
  };

  const move = (e: React.PointerEvent) => {
    const g = grab.current;
    const el = sheet.current;
    if (!g || !el || e.pointerId !== g.id) return;
    const raw = e.clientY - g.from;
    g.y = raw < 0 ? -rubber(-raw, el.offsetHeight) : raw;
    g.samples = [...g.samples, { t: performance.now(), y: e.clientY }].slice(-5);
    paint(g.y);
  };

  const up = (e: React.PointerEvent) => {
    const g = grab.current;
    const el = sheet.current;
    if (!g || !el || e.pointerId !== g.id) return;
    grab.current = null;
    const first = g.samples[0];
    const last = g.samples[g.samples.length - 1];
    const dt = last.t - first.t;
    const v = dt > 8 ? ((last.y - first.y) / dt) * 1000 : 0; // px/s, downward positive
    // Dismiss if the throw is heading past the halfway mark, however little it has actually moved.
    if (g.y + project(v) > el.offsetHeight * 0.4) settle(el.offsetHeight, Math.abs(v), onClose);
    else settle(0, Math.abs(v));
  };

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={label}>
      <button ref={scrim} aria-label="Close" onClick={onClose}
        className="ops-scrim absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <div ref={sheet}
        className="ops-sheet absolute inset-x-0 bottom-0 flex max-h-[86vh] flex-col rounded-t-[22px] bg-[var(--chrome)] pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_rgb(0_0_0/0.45)]"
>
        {/* Grab anywhere in the head; the list below keeps its own scroll */}
        <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          className="shrink-0 cursor-grab touch-none active:cursor-grabbing">
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/25" aria-hidden />
          {head}
        </div>
        <div className="ops-scroll flex-1 overflow-y-auto overscroll-contain" style={{ touchAction: "pan-y" }}>{children}</div>
        {foot}
      </div>
    </div>
  );
}
