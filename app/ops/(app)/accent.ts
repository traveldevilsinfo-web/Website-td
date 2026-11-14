import type { Biz } from "@/lib/ops-rules";

/**
 * A whole palette per business, not just an accent, so a glance tells you whose books are open.
 *
 * Finzo Stays wears the look of the listings it manages: coral, warm paper, warm charcoal chrome.
 * Travel Devils wears a cold alpine blue on cool grey — far enough from coral that the switch is
 * never in doubt, which is the entire job of the switch.
 *
 * `acc` is the brand hue, for rails, dots, bars and tints. `accInk` is the darker sibling used
 * wherever white text sits on top (buttons, badges), because white on raw coral is only 3.9:1.
 */
export type Theme = {
  acc: string; accInk: string; accSoft: string;
  bg: string; surface: string; sunk: string; line: string; ink: string; muted: string;
  chrome: string; chromeLine: string;
};

export const THEME: Record<Biz, Theme> = {
  td: {
    acc: "#2f54eb", accInk: "#2546c8", accSoft: "#eef2ff",
    bg: "#f2f4f8", surface: "#ffffff", sunk: "#f7f8fc", line: "#e2e6ee", ink: "#0d1220", muted: "#5a6478",
    chrome: "#0b1020", chromeLine: "rgba(255,255,255,.08)",
  },
  finzo: {
    acc: "#ff385c", accInk: "#d61f4e", accSoft: "#fff1f3",
    bg: "#f7f5f2", surface: "#ffffff", sunk: "#faf8f5", line: "#e8e2da", ink: "#1b1613", muted: "#6b6054",
    chrome: "#17110e", chromeLine: "rgba(255,255,255,.09)",
  },
};

/** The CSS custom properties the whole back office reads. Set on the shell, swapped by the switch. */
export const themeVars = (biz: Biz) => {
  const th = THEME[biz];
  return {
    "--acc": th.acc, "--acc-ink": th.accInk, "--acc-soft": th.accSoft,
    "--bg": th.bg, "--surface": th.surface, "--sunk": th.sunk, "--line": th.line, "--ink": th.ink, "--muted": th.muted,
    "--chrome": th.chrome, "--chrome-line": th.chromeLine,
  } as React.CSSProperties;
};

export const ACCENT: Record<Biz, string> = { td: THEME.td.acc, finzo: THEME.finzo.acc };
export const BIZ_SHORT: Record<Biz, string> = { td: "TD", finzo: "FS" };
