import Link from "next/link";
import type { Faq } from "@/db/schema";
import { md } from "@/lib/markdown";
import { CtaBand, Faqs, PageHero, TripCard, type CardTrip } from "./ui";

/** Shared layout for category / destination / month / collection pages. */
export function ListingPage({ title, intro, image, crumbs, trips, chips, content, faqs, empty }: {
  title: string; intro?: string | null; image?: string | null;
  crumbs: { label: string; href?: string }[];
  trips: CardTrip[];
  chips?: { label: string; href: string; active?: boolean }[];
  content?: string | null; faqs?: Faq[]; empty?: string;
}) {
  return (
    <>
      <PageHero title={title} intro={intro} image={image ?? trips.find((t) => t.coverImage)?.coverImage} crumbs={crumbs} />

      {chips && chips.length > 1 && (
        <nav aria-label="Filter" className="border-b border-line">
          <div className="rail mx-auto max-w-7xl gap-2 py-4 [grid-auto-columns:max-content]">
            {chips.map((c) => (
              <Link key={c.href} href={c.href} aria-current={c.active ? "page" : undefined}
                className={`press rounded-full px-5 py-2.5 text-sm font-extrabold ${c.active ? "bg-ink text-white" : "bg-surface hover:bg-line"}`}>
                {c.label}
              </Link>
            ))}
          </div>
        </nav>
      )}

      <section className="mx-auto max-w-7xl px-4 py-12">
        <p className="mb-6 text-sm font-bold text-muted">{trips.length} trip{trips.length === 1 ? "" : "s"}</p>
        {trips.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {trips.map((t, i) => <div key={t.id} className="reveal"><TripCard trip={t} priority={i < 4} /></div>)}
          </div>
        ) : (
          <div className="rounded-[2rem] bg-surface p-12 text-center">
            <p className="headline text-2xl">{empty ?? "New departures are being planned."}</p>
            <p className="mt-2 text-muted">Tell us where you want to go and we&apos;ll put a trip together for you.</p>
          </div>
        )}
      </section>

      {content && (
        <section className="mx-auto max-w-3xl px-4 pb-8">
          <div className="prose-admin" dangerouslySetInnerHTML={{ __html: md(content) }} />
        </section>
      )}
      <Faqs items={faqs ?? []} />
      <CtaBand />
    </>
  );
}
