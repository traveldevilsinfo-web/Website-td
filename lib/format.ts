export const inr = (n: number | null | undefined) => (n == null ? "" : `₹${n.toLocaleString("en-IN")}`);

export const durationLabel = (d: number, n: number) => (n ? `${n}N/${d}D` : `${d} Day${d > 1 ? "s" : ""}`);

export const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
export const monthShort = (iso: string) => new Date(iso + "T00:00:00").toLocaleString("en-IN", { month: "short" });
export const dateShort = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
/** "Fri, 26 Sep" */
export const dateDay = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

// ---- Departure dates. ISO yyyy-mm-dd strings, computed in UTC so the server's timezone can't shift a day.
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const utc = (iso: string) => new Date(iso + "T00:00:00Z");
export const addDays = (iso: string, n: number) => new Date(utc(iso).getTime() + n * 864e5).toISOString().slice(0, 10);
export const weekdayOf = (iso: string) => utc(iso).getUTCDay();

/** Every `weekday` (0 = Sunday) strictly after `after`, up to and including `until`. */
export function weeklyDates(weekday: number, after: string, until: string): string[] {
  let d = addDays(after, ((weekday - weekdayOf(after) + 6) % 7) + 1);
  const out: string[] = [];
  for (; d <= until; d = addDays(d, 7)) out.push(d);
  return out;
}

/** "Every Friday" when the upcoming departures all fall on one weekday (3+ of them), else null. */
export function repeatLabel(starts: string[]): string | null {
  if (starts.length < 3) return null;
  const w = weekdayOf(starts[0]);
  return starts.every((s) => weekdayOf(s) === w) ? `Every ${WEEKDAYS[w]}` : null;
}

type TripPath = { slug: string; categorySlug: string | null; region: string | null; destinationSlug: string | null };
/** /{category}/{india|international}/{destination}/{trip}. Falls back to /trips/{slug} for unassigned trips. */
export const tripHref = (t: TripPath) =>
  t.categorySlug && t.region && t.destinationSlug ? `/${t.categorySlug}/${t.region}/${t.destinationSlug}/${t.slug}` : `/trips/${t.slug}`;

export const BATCH_LABEL: Record<string, string> = { available: "Available", filling_fast: "Filling fast", sold_out: "Sold out", closed: "Closed" };

/** Tag-driven collection pages (JW-style landing URLs). */
export const COLLECTIONS: Record<string, { tag?: string; sale?: boolean; title: string; intro: string }> = {
  "best-sellers": { tag: "best-seller", title: "Best Sellers", intro: "Our most-booked group trips. Loved by travellers, run on repeat." },
  "early-bird-offers": { sale: true, title: "Early Bird Offers", intro: "Book early, pay less. Every trip currently running a discounted price." },
  "all-girls-trips": { tag: "all-girls", title: "All Girls Trips", intro: "Women-only group trips with female trip captains, safe stays and a squad you'll keep for life." },
  "honeymoon-trips": { tag: "honeymoon", title: "Honeymoon Trips", intro: "Private, unhurried escapes for two. Tell us your dates and we'll handle the rest." },
  "new-launches": { tag: "new-launch", title: "New Launches", intro: "Fresh routes we've just scouted. Be the first batch to go." },
  "long-weekend-trips": { tag: "long-weekend", title: "Long Weekend Trips", intro: "Make every long weekend count with quick, well-planned getaways." },
  "christmas-and-new-year-trips-and-treks": { tag: "xmas-new-year", title: "Christmas & New Year Trips", intro: "Ring in the new year in the mountains with bonfires, snow and your new favourite people." },
};
