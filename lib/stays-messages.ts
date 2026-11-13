// WhatsApp message templates for a stay: one tap opens WhatsApp with the text ready; a person presses send.
import { normalizePhone } from "./lead";
import { dateDay } from "./format";

type Flat = { name: string; address: string | null; checkinTime: string; checkoutTime: string; wifiName: string | null; wifiPass: string | null; lockCode: string | null };
type Stay = { guestName: string | null; checkIn: string; checkOut: string; phone: string | null };

export const MESSAGE_KINDS = ["confirm", "checkin", "checkout", "review"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];
export const MESSAGE_LABEL: Record<MessageKind, string> = { confirm: "Booking confirmed", checkin: "Check-in details", checkout: "Check-out reminder", review: "Ask for a review" };

/**
 * The door code and Wi-Fi password never go into WhatsApp: a chat is forwarded, backed up and read on lock
 * screens. The message carries the guest's own link, and that page shows the code once they've checked in.
 */
export function stayMessage(kind: MessageKind, flat: Flat, s: Stay, link: string): string {
  const hi = `Hi ${s.guestName?.split(" ")[0] || "there"}`;
  switch (kind) {
    case "confirm":
      return `${hi}, your stay at ${flat.name} is confirmed for ${dateDay(s.checkIn)} → ${dateDay(s.checkOut)}. Check-in is from ${flat.checkinTime}.\nPlease check in here before you arrive — it takes a minute, and your door code and Wi-Fi appear on the same page: ${link}\n— Finzo Stays`;
    case "checkin":
      return [`${hi}, welcome to ${flat.name}!`, flat.address && `Address: ${flat.address}`, `Check-in from ${flat.checkinTime}.`,
        `Your door code and Wi-Fi are here: ${link}`, "Message us here anytime. — Finzo Stays"].filter(Boolean).join("\n");
    case "checkout":
      return `${hi}, a reminder that check-out is tomorrow (${dateDay(s.checkOut)}) by ${flat.checkoutTime}. Please leave the keys inside and close the windows. Safe travels! — Finzo Stays`;
    case "review":
      return `${hi}, thank you for staying at ${flat.name}! If you enjoyed it, a review would mean a lot to our small team. — Finzo Stays`;
  }
}

/** wa.me link, or null if there's no valid Indian mobile. */
export function whatsappLink(phone: string | null, text: string): string | null {
  const n = phone ? normalizePhone(phone) : null;
  return n ? `https://wa.me/91${n}?text=${encodeURIComponent(text)}` : null;
}
