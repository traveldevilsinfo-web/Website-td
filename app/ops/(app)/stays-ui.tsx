import type { Tone } from "../kit";

export const CHANNEL_LABEL = { airbnb: "Airbnb", booking: "Booking.com", vrbo: "Vrbo", mmt: "MakeMyTrip", direct: "Direct", other: "Other" } as const;
export type Channel = keyof typeof CHANNEL_LABEL;
/**
 * Channel colours (design system §3): each channel keeps its own brand hue, so a glance at the
 * calendar says who sold the night. Direct is teal rather than the business accent, because the
 * Finzo accent is Airbnb's own coral and the two dots would be indistinguishable.
 */
export const CHANNEL_COLOR: Record<Channel, string> = { airbnb: "#ff385c", booking: "#1d4ed8", vrbo: "#0e7490", mmt: "#7c3aed", direct: "#0f766e", other: "#52525b" };
export const STAY_TONE: Record<string, Tone> = { confirmed: "green", blocked: "gray", cancelled: "red" };
export const TURN_TONE: Record<string, Tone> = { todo: "amber", doing: "blue", done: "green", issue: "red" };
export const TURN_LABEL: Record<string, string> = { todo: "To do", doing: "In progress", done: "Done", issue: "Problem" };

export const ChannelDot = ({ c }: { c: Channel }) => <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: CHANNEL_COLOR[c] }} aria-hidden />;
