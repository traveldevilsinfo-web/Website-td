// Pure guest-side rules: which message is due, the check-in agreement, ID photo uploads, and what the
// guest's own page should show. No DB, no server-only: tested in lib/checks.mts.
import { addDays } from "./format";
import type { MessageKind } from "./stays-messages";
import type { StayStatus } from "./stays";

type Stay = { checkIn: string; checkOut: string; status: StayStatus };

/**
 * Messages worth sending today, in the order they'd be sent. Nothing mid-stay: guests are left alone
 * unless they write first. `sent` is what has already gone out for this stay.
 */
export function dueMessageKinds(s: Stay, today: string, sent: MessageKind[]): MessageKind[] {
  if (s.status !== "confirmed") return [];
  const due: MessageKind[] = [];
  if (today < s.checkIn) due.push("confirm");
  if (today === s.checkIn || today === addDays(s.checkIn, -1)) due.push("checkin");
  if (today === addDays(s.checkOut, -1)) due.push("checkout");
  if (today === s.checkOut || today === addDays(s.checkOut, 1)) due.push("review");
  return due.filter((k) => !sent.includes(k));
}

/** Click-wrap signature: a typed name plus a ticked box (Indian IT Act §10A). */
export function agreementError(name: string, agreed: boolean): string | null {
  const n = name.trim();
  if (n.length < 2 || n.length > 120) return "Type your full name as your signature.";
  if (!agreed) return "Please tick the box to accept the house rules.";
  return null;
}

/** Which version of their page a guest sees. The door code waits until the day before they arrive. */
export function guestStage(s: Stay & { agreedAt: Date | null }, today: string): "cancelled" | "over" | "checkin" | "soon" | "ready" {
  if (s.status !== "confirmed") return "cancelled";
  if (today > s.checkOut) return "over";
  if (!s.agreedAt) return "checkin";
  return today >= addDays(s.checkIn, -1) ? "ready" : "soon";
}

// ------------------------------------------------------------------ guidebook
// One text box, sections split by "## Heading": easy to edit on a phone, no drag-and-drop list.

export type GuideSection = { title: string; body: string };

export function parseGuide(text: string): GuideSection[] {
  const out: GuideSection[] = [];
  let title = "Good to know", body: string[] = [];
  const push = () => { const b = body.join("\n").trim(); if (b) out.push({ title: title.trim() || "Good to know", body: b }); };
  for (const line of text.split(/\r?\n/)) {
    const h = /^##\s*(.*)$/.exec(line);
    if (h) { push(); title = h[1]; body = []; } else body.push(line);
  }
  push();
  return out;
}

export const formatGuide = (sections: GuideSection[]) => sections.map((s) => `## ${s.title}\n${s.body}`).join("\n\n");
