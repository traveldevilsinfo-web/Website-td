import Image from "next/image";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { BATCH_LABEL, dateShort, durationLabel, inr, repeatLabel, tripHref } from "@/lib/format";
import { OpenCustomTrip } from "@/components/CustomTripDialog";

export type CardTrip = {
  id: number; slug: string; title: string; coverImage: string | null; basePrice: number | null; salePrice: number | null;
  durationDays: number; durationNights: number; startLocation: string | null; endLocation: string | null; tags: string[];
  categorySlug: string | null; categoryName: string | null; destinationSlug: string | null; destinationName: string | null;
  region: string | null; batches: { start: string; status: string }[];
};

const Pin = () => (
  <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden><path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.2 4.5 8.5 4.5 8.5s4.5-5.3 4.5-8.5A4.5 4.5 0 0 0 8 1.5Zm0 6.2a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Z" /></svg>
);

export function TripCard({ trip, priority, className = "" }: { trip: CardTrip; priority?: boolean; className?: string }) {
  const price = trip.salePrice ?? trip.basePrice;
  const open = trip.batches.filter((b) => b.status !== "sold_out");
  const next = open[0];
  const badge = trip.tags.includes("new-launch") ? "New" : next?.status === "filling_fast" ? "Filling fast" : trip.tags.includes("best-seller") ? "Best seller" : null;
  return (
    <Link href={tripHref(trip)} className={`card group flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white ${className}`}>
      <div className="relative aspect-[4/3] overflow-hidden bg-surface">
        {trip.coverImage && (
          <Image src={trip.coverImage} alt={trip.title} fill loading={priority ? "eager" : undefined} fetchPriority={priority ? "high" : undefined} sizes="(max-width: 640px) 80vw, (max-width: 1024px) 45vw, 320px" className="object-cover" />
        )}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="glass rounded-full px-3 py-1 text-xs font-extrabold text-ink shadow-sm">{durationLabel(trip.durationDays, trip.durationNights)}</span>
          {badge && <span className="rounded-full bg-brand px-3 py-1 text-xs font-extrabold text-white shadow">{badge}</span>}
        </div>
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        {trip.destinationName && <p className="flex items-center gap-1 text-xs font-bold text-muted"><Pin />{trip.destinationName}</p>}
        <h3 className="headline mt-1 text-lg leading-snug">{trip.title}</h3>
        {trip.startLocation && (
          <p className="mt-1 text-xs font-semibold text-muted">{trip.startLocation} → {trip.endLocation || trip.startLocation}</p>
        )}
        {open.length > 0 && (
          <div className="mt-3 rounded-2xl bg-surface px-3 py-2.5">
            <p className="text-xs font-extrabold text-brand">
              <RepeatBadge label={repeatLabel(open.map((b) => b.start)) ?? `${open.length} upcoming date${open.length === 1 ? "" : "s"}`} className="[&_svg]:size-3.5" />
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-1">
              {open.slice(0, 3).map((b) => (
                <span key={b.start} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-ink ring-1 ring-line">{dateShort(b.start)}</span>
              ))}
              {open.length > 3 && <span className="px-1 text-[11px] font-bold text-muted">+{open.length - 3} more</span>}
            </p>
          </div>
        )}
        <div className="mt-auto flex items-end justify-between pt-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Starting from</p>
            <p className="text-lg font-extrabold">
              {price ? inr(price) : "On request"}
              {trip.salePrice && trip.basePrice && <span className="ml-2 text-sm font-semibold text-muted line-through">{inr(trip.basePrice)}</span>}
            </p>
          </div>
          <span className="grid size-10 place-items-center rounded-full bg-ink text-white transition-transform duration-500 group-hover:translate-x-1" aria-hidden>→</span>
        </div>
      </div>
    </Link>
  );
}

export function SectionHead({ eyebrow, title, subtitle, href, hrefLabel = "View all", children }: {
  eyebrow?: string; title: string; subtitle?: string; href?: string; hrefLabel?: string; children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto mb-8 flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2 text-brand">{eyebrow}</p>}
        <h2 className="headline text-3xl sm:text-[2.6rem]">{title}</h2>
        {subtitle && <p className="mt-3 text-lg text-muted">{subtitle}</p>}
      </div>
      {children}
      {href && (
        <Link href={href} className="press rounded-full border border-line px-5 py-2.5 text-sm font-extrabold hover:border-ink">
          {hrefLabel} →
        </Link>
      )}
    </div>
  );
}

export function CtaBand({ title = "Can't find your kind of trip?", text = "Tell us your dates, group and budget. We'll design it end to end." }: { title?: string; text?: string }) {
  return (
    <section className="reveal mx-auto max-w-7xl px-4 py-12">
      <div className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-14 text-center text-white sm:px-16">
        <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-brand/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 size-72 rounded-full bg-accent/25 blur-3xl" />
        <h2 className="headline relative text-3xl sm:text-5xl">{title}</h2>
        <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/75">{text}</p>
        <OpenCustomTrip className="press relative mt-8 rounded-full bg-white px-8 py-4 text-base font-extrabold text-ink hover:bg-white/90">
          Plan a custom trip
        </OpenCustomTrip>
      </div>
    </section>
  );
}

export function BatchPill({ start, status }: { start: string; status: string }) {
  const tone = status === "filling_fast" ? "bg-amber-50 text-amber-800 ring-amber-200" : status === "sold_out" ? "bg-gray-100 text-muted line-through ring-gray-200" : "bg-green-50 text-green-800 ring-green-200";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${tone}`} title={BATCH_LABEL[status]}>{dateShort(start)}</span>;
}

export function PageHero({ title, intro, image, crumbs }: { title: string; intro?: string | null; image?: string | null; crumbs?: { label: string; href?: string }[] }) {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-white">
      {image && <Image src={image} alt="" fill loading="eager" fetchPriority="high" sizes="100vw" className="-z-10 object-cover opacity-60" />}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/30 via-black/20 to-black/70" />
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-16 sm:pb-20 sm:pt-24">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap gap-1.5 text-sm font-semibold text-white/70">
            {crumbs.map((c, i) => (
              <span key={i} className="flex gap-1.5">
                {c.href ? <Link href={c.href} className="hover:text-white">{c.label}</Link> : <span className="text-white">{c.label}</span>}
                {i < crumbs.length - 1 && <span aria-hidden>/</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="display max-w-4xl text-4xl sm:text-6xl">{title}</h1>
        {intro && <p className="mt-5 max-w-2xl text-lg text-white/80 sm:text-xl">{intro}</p>}
      </div>
    </section>
  );
}

export function RepeatBadge({ label, className = "" }: { label: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <CalendarDays className="size-4 shrink-0" aria-hidden />{label}
    </span>
  );
}
