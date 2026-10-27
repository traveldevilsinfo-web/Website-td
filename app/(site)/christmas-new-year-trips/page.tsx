import type { Metadata } from "next";
import Link from "next/link";
import { CalendarHeart, Gift, MessageCircle, Moon, Sparkles, TreePine } from "lucide-react";
import { getHolidayTrips, holidayWindow } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { og } from "@/lib/seo";
import { dateDay, inr, tripHref } from "@/lib/format";
import { OpenLeadButton } from "@/components/LeadDialog";
import { Burst, Countdown, HolidayGrid, MidnightClock, Snowfall } from "@/components/site/holiday/Holiday";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { newYear } = holidayWindow();
  const title = `Christmas & New Year Trips ${newYear - 1}–${String(newYear).slice(2)}`;
  const description = `Group trips departing on Christmas (24 & 25 Dec) and New Year (30 Dec) ${newYear - 1}: snow, bonfires and New Year in the Himalayas. Holiday dates and festive prices in one place.`;
  return { title, description, alternates: { canonical: "/christmas-new-year-trips" }, openGraph: og({ title: `${title} | Travel Devils`, description, url: "/christmas-new-year-trips" }) };
}

// String lights: three swags across the top. Bulb positions follow the same quadratic curve as the wire.
const BULB_COLORS = ["#ff4d5e", "#f7c95c", "#5fd39a", "#7cc4ff", "#ffffff"];
const BULBS = Array.from({ length: 31 }, (_, i) => {
  const x = i / 30, s = (x * 3) % 1;
  return { left: `${x * 100}%`, top: 6 + 104 * s * (1 - s) * 0.5, c: BULB_COLORS[i % 5], d: `${(i * 0.37) % 2.6}s`, r: `${(s - 0.5) * 24}deg` };
});

export default async function ChristmasNewYear() {
  const [{ window: w, trips }, settings] = await Promise.all([getHolidayTrips(), getSettings()]);
  const year = w.newYear - 1;
  const nye = (b: { start: string; end: string }) => b.start <= `${year}-12-31` && b.end >= `${w.newYear}-01-01`;
  const onTripAtMidnight = trips.flatMap((t) => t.holidayDates.filter(nye).slice(0, 1).map((b) => ({ t, b })));
  // A short, varied pick (one per destination, longest trips first); the full list is a filter on the grid.
  const midnight = [...onTripAtMidnight].sort((x, y) => y.t.durationDays - x.t.durationDays)
    .filter((m, i, all) => all.findIndex((o) => o.t.destinationName === m.t.destinationName) === i).slice(0, 6);
  const departures = trips.reduce((a, t) => a + t.holidayDates.length, 0);
  const cheapest = Math.min(...trips.map((t) => t.holidayPrice ?? t.salePrice ?? t.basePrice ?? Infinity));

  return (
    <div className="xmas overflow-hidden">
      {/* ---------------------------------------------------------------- Hero */}
      <section className="xmas-sky relative isolate flex min-h-[min(88vh,820px)] items-center pb-40 pt-24">
        <Snowfall />
        <div className="absolute inset-x-0 top-0 h-12" aria-hidden>
          <svg viewBox="0 0 300 40" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            <path d="M0 6 Q50 58 100 6 Q150 58 200 6 Q250 58 300 6" fill="none" stroke="#2c3550" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          </svg>
          {BULBS.map((b, i) => <span key={i} className={`xmas-bulb ${i % 2 ? "max-sm:hidden" : ""}`} style={{ left: b.left, top: b.top, "--c": b.c, "--d": b.d, "--r": b.r } as React.CSSProperties} />)}
        </div>
        <Burst className="left-[12%] top-[26%] max-sm:hidden" color="#f7c95c" dist={90} />
        <Burst className="right-[14%] top-[20%]" color="#ff5a6e" delay={1.8} dist={80} />
        <Burst className="right-[30%] top-[46%] max-sm:hidden" color="#7fe0b0" delay={3.4} dist={60} />

        <div className="relative mx-auto w-full max-w-7xl px-4">
          <p className="fade-in inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.18em] text-white/80 backdrop-blur-md">
            <TreePine className="size-4 text-[#5fd39a]" aria-hidden /> Christmas &amp; New Year {year}–{String(w.newYear).slice(2)}
          </p>
          <h1 className="headline mt-6 max-w-4xl text-[2.6rem] leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            <span className="word-in block">Christmas in the hills.</span>
            <span className="word-in xmas-gold block [animation-delay:120ms]">New Year under the stars.</span>
          </h1>
          <p className="fade-in mt-6 max-w-xl text-lg font-semibold text-white/75 [animation-delay:240ms]">
            Snow, bonfires and a countdown with a group that becomes your gang. Every Christmas (24 &amp; 25 Dec) and New Year (30 Dec) departure, in one place.
          </p>
          <div className="fade-in mt-8 flex flex-wrap items-end gap-x-10 gap-y-6 [animation-delay:360ms]">
            <Countdown year={year} />
            <div className="flex flex-wrap gap-3">
              <a href="#departures" className="press rounded-full bg-[var(--x-gold)] px-6 py-3.5 text-sm font-extrabold text-[#1a1203] shadow-[0_10px_40px_-8px_var(--x-gold)] hover:brightness-105">See holiday departures</a>
              <a href="#plan-my-trip" className="press rounded-full border border-white/25 px-6 py-3.5 text-sm font-extrabold hover:bg-white/10">Plan a private group</a>
            </div>
          </div>
          {trips.length > 0 && (
            <dl className="fade-in mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm [animation-delay:480ms]">
              <div><dt className="text-white/55">Trips</dt><dd className="text-2xl font-extrabold">{trips.length}</dd></div>
              <div><dt className="text-white/55">Holiday departures</dt><dd className="text-2xl font-extrabold">{departures}</dd></div>
              {Number.isFinite(cheapest) && <div><dt className="text-white/55">From</dt><dd className="text-2xl font-extrabold">{inr(cheapest)}</dd></div>}
            </dl>
          )}
        </div>

        {/* Snow-capped ranges fading into the page */}
        <svg viewBox="0 0 1440 220" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-40 w-full sm:h-52" aria-hidden>
          <path d="M0 150 L120 90 L210 130 L330 52 L450 128 L560 80 L690 140 L820 60 L950 120 L1080 70 L1210 130 L1330 84 L1440 120 V220 H0Z" fill="#1b3168" />
          {/* snow caps sit on the three tallest peaks, following their slopes */}
          <path d="M330 52 L374 80 L356 75 L340 84 L322 76 L305 82 L287 80Z M820 60 L881 88 L858 82 L838 92 L816 83 L795 90 L775 88Z M1080 70 L1128 92 L1108 87 L1090 95 L1070 88 L1023 92Z" fill="#e8eefc" opacity=".92" />
          <path d="M0 190 L160 140 L300 176 L470 128 L640 182 L800 136 L980 186 L1150 146 L1300 180 L1440 150 V220 H0Z" fill="#0d1838" />
          <rect y="205" width="1440" height="15" fill="#081026" />
        </svg>
      </section>

      {/* ---------------------------------------------------------------- Departures */}
      <section id="departures" className="relative mx-auto max-w-7xl scroll-mt-28 px-4 pb-20 pt-6">
        <span id="midnight" className="absolute -top-28" aria-hidden />
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-[var(--x-gold)]">Holiday departures</p>
            <h2 className="headline mt-2 text-3xl sm:text-[2.6rem]">Pick the day you leave</h2>
          </div>
          <p className="max-w-sm text-sm font-semibold text-white/60">Christmas &amp; New Year batches run at their own festive price, shown on each trip. Seats are limited per batch.</p>
        </div>
        {trips.length ? <HolidayGrid trips={trips} year={year} /> : (
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.05] p-10 text-center">
            <p className="headline text-2xl">Holiday dates are being planned.</p>
            <p className="mt-2 text-white/65">Tell us where you&apos;d like to be and we&apos;ll message you first.</p>
            <OpenLeadButton destination="Christmas & New Year trip" className="press mt-5 rounded-full bg-[var(--x-gold)] px-6 py-3 text-sm font-extrabold text-[#1a1203]">Get notified</OpenLeadButton>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- Midnight */}
      {midnight.length > 0 && (
        <section className="relative mx-auto max-w-7xl px-4 pb-20">
          <div className="grid items-center gap-10 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#152a63] via-[#0f1d45] to-[#081026] p-6 sm:p-10 lg:grid-cols-[auto_1fr]">
            <MidnightClock />
            <div>
              <p className="eyebrow inline-flex items-center gap-2 text-[var(--x-gold)]"><Moon className="size-4" aria-hidden /> 31 December, 11:59 PM</p>
              <h2 className="headline mt-2 text-3xl sm:text-4xl">Where you&apos;ll be when the clock strikes twelve</h2>
              <p className="mt-2 max-w-xl text-white/65">These departures are on the road over New Year&apos;s Eve, so you ring in {w.newYear} with the group.</p>
              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {midnight.map(({ t, b }) => (
                  <li key={t.id}>
                    <Link href={tripHref(t)} className="press group flex items-center justify-between gap-3 rounded-2xl bg-white/[0.06] px-4 py-3 ring-1 ring-white/10 transition-colors hover:bg-white/[0.11] hover:ring-[var(--x-gold)]/50">
                      <span className="min-w-0">
                        <span className="block truncate font-extrabold">{t.title}</span>
                        <span className="text-xs font-bold text-white/55">{dateDay(b.start)} – {dateDay(b.end)}</span>
                      </span>
                      <Sparkles className="size-4 shrink-0 text-[var(--x-gold)] transition-transform duration-300 group-hover:rotate-12 group-hover:scale-125" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              {onTripAtMidnight.length > midnight.length && (
                <a href="#midnight" className="press mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[var(--x-gold)] hover:underline">
                  See all {onTripAtMidnight.length} New Year&apos;s Eve departures ↑
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- Good to know */}
      <section className="relative mx-auto max-w-7xl px-4 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: CalendarHeart, title: "Book the date, not just the trip", text: "Holiday batches are counted per departure. Pick your date on the trip page to see live seats." },
            { icon: Gift, title: "Festive prices, clearly marked", text: "Christmas & New Year batches have their own price. The trip page switches to it when you choose one of those dates." },
            { icon: MessageCircle, title: "Coming as a group?", text: "Office gang or friends' group: we can plan a private holiday departure around your dates." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="xmas-reveal rounded-[1.75rem] border border-white/10 bg-white/[0.05] p-6">
              <span className="grid size-11 place-items-center rounded-2xl bg-[var(--x-gold)]/15 text-[var(--x-gold)]"><Icon className="size-5" aria-hidden /></span>
              <h3 className="headline mt-4 text-lg">{title}</h3>
              <p className="mt-1.5 text-sm font-semibold leading-relaxed text-white/65">{text}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="headline text-2xl sm:text-3xl">Not sure which one? Ask us.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <OpenLeadButton destination="Christmas & New Year trip" className="press rounded-full bg-[var(--x-gold)] px-6 py-3.5 text-sm font-extrabold text-[#1a1203]">Send an enquiry</OpenLeadButton>
            <a href={`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent("Hi Travel Devils! I'm looking for a Christmas / New Year trip.")}`} target="_blank" rel="noopener noreferrer" className="press rounded-full border border-white/25 px-6 py-3.5 text-sm font-extrabold hover:bg-white/10">WhatsApp us</a>
          </div>
        </div>
      </section>
    </div>
  );
}
