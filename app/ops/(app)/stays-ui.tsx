import type { Tone } from "../kit";

export const CHANNEL_LABEL = { airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo", mmt: "MakeMyTrip", direct: "Direct", other: "Other" } as const;
export type Channel = keyof typeof CHANNEL_LABEL;
/** Channel colours (design system §3). Direct uses the business accent. */
export const CHANNEL_COLOR: Record<Channel, string> = { airbnb: "#e0565b", booking: "#2563eb", vrbo: "#0e7490", mmt: "#7c3aed", direct: "var(--acc)", other: "#52525b" };
export const STAY_TONE: Record<string, Tone> = { confirmed: "green", blocked: "gray", cancelled: "red" };
export const TURN_TONE: Record<string, Tone> = { todo: "amber", doing: "blue", done: "green", issue: "red" };
export const TURN_LABEL: Record<string, string> = { todo: "To do", doing: "In progress", done: "Done", issue: "Problem" };

export const ChannelDot = ({ c }: { c: Channel }) => <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: CHANNEL_COLOR[c] }} aria-hidden />;
