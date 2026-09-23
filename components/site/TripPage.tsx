import Image from "next/image";
import Link from "next/link";
import type { getTrip } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { getCategories, getPosts, getTrips } from "@/lib/queries";
import { tableFilled, type PolicyTable } from "@/lib/site";
import { dateDay, durationLabel, inr, repeatLabel, tripHref } from "@/lib/format";
import { md } from "@/lib/markdown";
import { OpenLeadButton } from "@/components/LeadDialog";
import { Rail } from "./Rail";
import { ExpandAll, Gallery, PriceCard, SectionTabs, ShareButton } from "./TripClient";
import { Departures } from "./Departures";
import { RepeatBadge, SectionHead, TripCard } from "./ui";

type Data = NonNullable<Awaited<ReturnType<typeof getTrip>>>;

const Check = ({ bad }: { bad?: boolean }) => (
  <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-black text-white ${bad ? "bg-gray-400" : "bg-green-600"}`} aria-hidden>
    {bad ? "✕" : "✓"}
  </span>
);

function Block({ id, title, children, action }: { id: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-[calc(9rem+var(--topbar-h,0px))] border-b border-line py-10 first:pt-0">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="headline text-2xl sm:text-3xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export async function TripPage({ data }: { data: Data }) {
  const { trip, category, destination, batches } = data;
  const [settings, related, cats, posts] = await Promise.all([
    getSettings(),
    getTrips({ destination: destination?.slug, excludeId: trip.id, limit: 8 }),
    getCategories(),
    getPosts(30),
  ]);
  const more = related.length >= 3 ? related : await getTrips({ category: category?.slug, excludeId: trip.id, limit: 8 });
  const images = [trip.coverImage, ...trip.gallery].filter((x): x is string => !!x);
  const specs = Object.entries(trip.trekSpecs).filter(([, v]) => v);
  const price = trip.salePrice ?? trip.basePrice;
  // Trip values win; otherwise fall back to the category (packing, age) and site-wide settings (policies).
  const toPack = trip.thingsToCarry.length ? trip.thingsToCarry : category?.thingsToPack ?? [];
  const ageRows = cats.filter((c) => c.ageLimit).map((c) => ({ label: c.name, value: c.id === category?.id && trip.ageLimit ? trip.ageLimit : c.ageLimit!, current: c.id === category?.id }));
  if (trip.ageLimit && !ageRows.some((a) => a.current)) ageRows.unshift({ label: "This trip", value: trip.ageLimit, current: true });
  const cancelTable = !trip.cancellationPolicy && tableFilled(settings.cancellationTable) ? settings.cancellationTable : null;
  const cancelText = trip.cancellationPolicy || settings.defaultCancellationPolicy;
  const payTable = tableFilled(settings.paymentTable) ? settings.paymentTable : null;
  const hasKnow = !!(trip.reportingPoint || trip.pickupPoints.length || trip.importantNotes || trip.routes.length);
  const route0 = trip.routes[0];
  const pickup = route0 ? `${route0.from || trip.startLocation} → ${route0.to || trip.endLocation || route0.from}` : trip.startLocation ? `${trip.startLocation} → ${trip.endLocation || trip.startLocation}` : null;
  // Blogs about this destination first, then the latest.
  const needle = [destination?.name, ...trip.tags].filter(Boolean).map((x) => x!.toLowerCase());
  const blogs = [...posts.filter((p) => needle.some((n) => p.title.toLowerCase().includes(n) || p.tags.map((t) => t.toLowerCase()).includes(n))), ...posts]
    .filter((p, i, a) => a.indexOf(p) === i).slice(0, 3);

  const open = batches.filter((b) => b.status !== "sold_out");
  const repeat = repeatLabel(batches.map((b) => b.startDate));
  const lastMonth = batches.length ? new Date(batches[batches.length - 1].startDate + "T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "";

  const sections = [
    { id: "overview", label: "Overview" },
    batches.length && { id: "dates", label: "Dates" },
    trip.itinerary.length && { id: "itinerary", label: "Itinerary" },
    (trip.includes.length || trip.excludes.length) && { id: "inclusions", label: "Inclusions & Exclusions" },
    (cancelTable || cancelText) && { id: "policy", label: "Cancellation Policy" },
    toPack.length && { id: "pack", label: "Things To Pack" },
    trip.faqs.length && { id: "faqs", label: "FAQs" },
  ].filter(Boolean) as { id: string; label: string }[];

  const crumbs = [
    { label: "Home", href: "/" },
    category && { label: category.name, href: `/${category.slug}` },
    destination && category && { label: destination.name, href: `/${category.slug}/${destination.region}/${destination.slug}` },
  ].filter(Boolean) as { label: string; href: string }[];

  // Structured data needs absolute URLs (relative breadcrumb items are invalid for Google).
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const abs = (u: string) => (/^https?:\/\//.test(u) ? u : site + u);
  const url = abs(tripHref({ slug: trip.slug, categorySlug: category?.slug ?? null, region: destination?.region ?? null, destinationSlug: destination?.slug ?? null }));
  const plain = (t: string | null | undefined) => t?.replace(/[#*_>\[\]()]/g, "").replace(/\s+/g, " ").trim();
  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "TouristTrip", name: trip.title, url,
      description: trip.seo.description || plain(trip.overview)?.slice(0, 300),
      image: images.slice(0, 5).map(abs), touristType: category?.name,
      provider: { "@type": "TravelAgency", "@id": `${site}/#org`, name: "Travel Devils", url: site },
      ...(trip.itinerary.length && {
        itinerary: {
          "@type": "ItemList", numberOfItems: trip.itinerary.length,
          itemListElement: trip.itinerary.map((d, i) => ({ "@type": "ListItem", position: i + 1, name: `Day ${i + 1}: ${d.title}` })),
        },
      }),
      offers: price ? {
        "@type": "Offer", price, priceCurrency: "INR", url, availability: batches.length ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
        ...(batches[0] && { availabilityStarts: batches[0].startDate }),
      } : undefined,
    },
    trip.faqs.length && {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: trip.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [...crumbs, { label: trip.title, href: url }].map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: abs(c.href) })),
    },
  ].filter(Boolean);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="mx-auto max-w-7xl px-4 pb-6 pt-8">
        <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap gap-1.5 text-sm font-semibold text-muted">
          {crumbs.map((c) => <span key={c.href} className="flex gap-1.5"><Link href={c.href} className="hover:text-ink">{c.label}</Link><span aria-hidden>/</span></span>)}
          <span className="text-ink">{trip.title}</span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="display text-4xl sm:text-6xl">{trip.title}</h1>
            <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
              <span className="rounded-full bg-surface px-3.5 py-1.5">{durationLabel(trip.durationDays, trip.durationNights)}</span>
              {destination && <span className="rounded-full bg-surface px-3.5 py-1.5">{destination.name}</span>}
              {pickup && (
                <a href="#price" className="press rounded-full bg-surface px-3.5 py-1.5 hover:bg-line">
                  Pickup &amp; drop: {pickup}{trip.routes.length > 1 && <span className="ml-1.5 text-brand">Change</span>}
                </a>
              )}
              {category && <span className="rounded-full bg-surface px-3.5 py-1.5">{category.name}</span>}
              {open.length > 0 && (
                <a href="#dates" className="press rounded-full bg-brand/10 px-3.5 py-1.5 text-brand-dark hover:bg-brand/15">
                  <RepeatBadge label={repeat ? `${repeat} · next ${dateDay(open[0].startDate)}` : `Next: ${dateDay(open[0].startDate)}`} />
                </a>
              )}
            </div>
          </div>
          <ShareButton title={trip.title} />
        </div>
      </div>

      <Gallery images={images} title={trip.title} />

      <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-10 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <SectionTabs sections={sections} />

          <Block id="overview" title="Overview">
            <div className="prose-admin max-w-none text-[17px]" dangerouslySetInnerHTML={{ __html: md(trip.overview) }} />
            {trip.highlights.length > 0 && (
              <div className="mt-8 rounded-3xl bg-surface p-6">
                <h3 className="eyebrow mb-4 text-brand">Trip highlights</h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {trip.highlights.map((h) => <li key={h} className="flex gap-3 font-semibold"><Check />{h}</li>)}
                </ul>
              </div>
            )}
            {specs.length > 0 && (
              <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {specs.map(([k, v]) => (
                  <div key={k} className="rounded-2xl border border-line p-4">
                    <dt className="text-xs font-bold uppercase tracking-wider text-muted">{k.replace(/([A-Z])/g, " $1")}</dt>
                    <dd className="mt-1 font-extrabold">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Block>

          {batches.length > 0 && (
            <Block id="dates" title="Upcoming departures"
              action={<p className="text-right text-sm font-bold text-muted">{repeat ? `${repeat} till ${lastMonth}` : `${open.length} dates`}</p>}>
              <Departures slug={trip.slug} batches={batches} bookable={settings.bookingsEnabled} />
            </Block>
          )}

          {trip.itinerary.length > 0 && (
            <Block id="itinerary" title="Day-wise itinerary" action={<ExpandAll target="itinerary-days" />}>
              <ol id="itinerary-days" className="relative space-y-3 before:absolute before:bottom-6 before:left-[1.4rem] before:top-6 before:w-px before:bg-line">
                {trip.itinerary.map((d, i) => (
                  <li key={i} className="relative">
                    <details className="acc group rounded-3xl border border-line bg-white transition-shadow open:shadow-[var(--shadow-card)]" open={i === 0}>
                      <summary className="flex items-center gap-4 p-4 pr-5">
                        <span className="relative z-10 grid size-11 shrink-0 place-items-center rounded-full bg-ink text-sm font-extrabold text-white group-open:bg-brand">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-bold uppercase tracking-wider text-muted">Day {i + 1}{d.distance ? ` · ${d.distance}` : ""}</span>
                          <span className="block font-extrabold leading-snug">{d.title}</span>
                        </span>
                        <span className="chev text-muted" aria-hidden>⌄</span>
                      </summary>
                      <div className="px-5 pb-5 sm:pl-[4.75rem]">
                        <div className="prose-admin text-muted" dangerouslySetInnerHTML={{ __html: md(d.content) }} />
                        {(d.meals || d.stay) && (
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                            {d.meals && <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">🍽 {d.meals}</span>}
                            {d.stay && <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-800">🛏 {d.stay}</span>}
                          </div>
                        )}
                      </div>
                    </details>
                  </li>
                ))}
              </ol>
              {trip.itineraryPdf && (
                <div className="mt-6 text-center">
                  <a href={trip.itineraryPdf} target="_blank" className="press inline-block rounded-full border-2 border-ink px-6 py-2.5 text-sm font-extrabold hover:bg-ink hover:text-white">Get PDF itinerary</a>
                </div>
              )}
            </Block>
          )}

          {(trip.includes.length > 0 || trip.excludes.length > 0) && (
            <Block id="inclusions" title="Inclusions & Exclusions">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl bg-green-50/60 p-6">
                  <h3 className="mb-4 font-extrabold text-green-800">Inclusions</h3>
                  <ul className="space-y-3">{trip.includes.map((x) => <li key={x} className="flex gap-3"><Check />{x}</li>)}</ul>
                </div>
                <div className="rounded-3xl bg-surface p-6">
                  <h3 className="mb-4 font-extrabold text-muted">Exclusions</h3>
                  <ul className="space-y-3">{trip.excludes.map((x) => <li key={x} className="flex gap-3"><Check bad />{x}</li>)}</ul>
                </div>
              </div>
            </Block>
          )}

          {(cancelTable || cancelText) && (
            <Block id="policy" title="Cancellation Policy">
              {cancelTable && <Policy table={cancelTable} />}
              {cancelText && <div className="prose-admin mt-4" dangerouslySetInnerHTML={{ __html: md(cancelText) }} />}
            </Block>
          )}

          {payTable && (
            <Block id="payment" title="Payment Policy">
              <Policy table={payTable} />
            </Block>
          )}

          {toPack.length > 0 && (
            <Block id="pack" title="Things To Pack">
              <ul className="grid gap-3 sm:grid-cols-2">
                {toPack.map((x) => (
                  <li key={x} className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3 font-semibold">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/10 text-sm" aria-hidden>🎒</span>{x}
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {hasKnow && (
            <Block id="know" title="Things to know">
              <div className="grid gap-4 sm:grid-cols-2">
                {trip.reportingPoint && <Info label="Reporting point">{trip.reportingPoint}</Info>}
                {trip.routes.length > 0 && (
                  <Info label="Pickup & drop options">
                    <ul className="space-y-1">{trip.routes.map((r) => <li key={r.name}>{r.name}{r.reporting && <span className="block text-sm font-normal text-muted">{r.reporting}{r.departTime && ` · departs ${r.departTime}`}</span>}</li>)}</ul>
                  </Info>
                )}
                {trip.pickupPoints.length > 0 && <Info label="Pickup points"><ul className="list-disc pl-5">{trip.pickupPoints.map((x) => <li key={x}>{x}</li>)}</ul></Info>}
              </div>
              {trip.importantNotes && <div className="prose-admin mt-6" dangerouslySetInnerHTML={{ __html: md(trip.importantNotes) }} />}
            </Block>
          )}

          {ageRows.length > 0 && (
            <Block id="age" title="Age Limit (Trip Wise)">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {ageRows.map((a) => (
                  <div key={a.label} className={`rounded-2xl border p-4 text-center ${a.current ? "border-brand bg-brand/5" : "border-line"}`}>
                    <p className="text-sm font-bold text-muted">{a.label}</p>
                    <p className="mt-1 text-xl font-extrabold">{a.value}</p>
                    {a.current && <p className="mt-1 text-[11px] font-extrabold uppercase tracking-wider text-brand">This trip</p>}
                  </div>
                ))}
              </div>
            </Block>
          )}

          {trip.faqs.length > 0 && (
            <Block id="faqs" title="FAQs">
              <div className="divide-y divide-line rounded-3xl border border-line">
                {trip.faqs.map((f, i) => (
                  <details key={i} className="acc px-6">
                    <summary className="flex items-center justify-between gap-4 py-5 font-extrabold">{f.q}<span className="chev text-muted" aria-hidden>⌄</span></summary>
                    <div className="prose-admin pb-5 text-muted" dangerouslySetInnerHTML={{ __html: md(f.a) }} />
                  </details>
                ))}
              </div>
            </Block>
          )}

          {trip.content && <div className="prose-admin py-10" dangerouslySetInnerHTML={{ __html: md(trip.content) }} />}
        </div>

        <aside className="hidden lg:block">
          <div id="price" className="sticky top-[calc(6rem+var(--topbar-h,0px))] scroll-mt-28">
            <PriceCard slug={trip.slug} bookable={settings.bookingsEnabled} title={trip.title} basePrice={trip.basePrice} salePrice={trip.salePrice} bookingAmount={trip.bookingAmount}
              pricing={trip.pricing} batches={batches} routes={trip.routes} whatsapp={settings.whatsapp} pdf={trip.itineraryPdf} priceNote={settings.priceNote} />
          </div>
        </aside>
      </div>

      {/* Price card for phones/tablets, placed after content */}
      <div className="mx-auto max-w-xl px-4 pt-8 lg:hidden" id="book">
        <PriceCard slug={trip.slug} bookable={settings.bookingsEnabled} title={trip.title} basePrice={trip.basePrice} salePrice={trip.salePrice} bookingAmount={trip.bookingAmount}
          pricing={trip.pricing} batches={batches} routes={trip.routes} whatsapp={settings.whatsapp} pdf={trip.itineraryPdf} priceNote={settings.priceNote} />
      </div>

      {settings.memories.length > 0 && (
        <section className="pt-20">
          <SectionHead title="Memories for life" subtitle="Real moments from past Travel Devils trips." />
          <Rail label="Traveller photos" size="wide">
            {settings.memories.map((src) => (
              <div key={src} className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-surface">
                <Image src={src} alt="Travellers on a Travel Devils trip" fill sizes="(max-width: 640px) 88vw, 33vw" className="object-cover" />
              </div>
            ))}
          </Rail>
        </section>
      )}

      {settings.testimonials.length > 0 && (
        <section className="pt-20">
          <SectionHead title="What travellers say" href={settings.reviewsUrl || undefined} hrefLabel="Read Google reviews" />
          <Rail label="Reviews" size="quote">
            {settings.testimonials.map((r) => (
              <figure key={r.name} className="flex h-full flex-col justify-between rounded-[1.75rem] border border-line bg-white p-6">
                <blockquote className="font-semibold leading-relaxed"><span className="text-accent" aria-label="5 stars">★★★★★</span><br />“{r.text}”</blockquote>
                <figcaption className="mt-4 text-sm"><b>{r.name}</b>{r.trip && <span className="text-muted"> · {r.trip}</span>}</figcaption>
              </figure>
            ))}
          </Rail>
        </section>
      )}

      {blogs.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-20">
          <h2 className="headline mb-6 text-3xl">Read before you go</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {blogs.map((b) => (
              <Link key={b.id} href={`/blog/${b.slug}`} className="card group overflow-hidden rounded-3xl bg-white">
                <div className="relative aspect-[16/10] bg-surface">{b.coverImage && <Image src={b.coverImage} alt="" fill sizes="33vw" className="object-cover" />}</div>
                <p className="headline p-5 text-lg">{b.title}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {more.length > 0 && (
        <section className="pt-20">
          <SectionHead title="You might also like" />
          <Rail label="Related trips">{more.map((t) => <TripCard key={t.id} trip={t} />)}</Rail>
        </section>
      )}

      {/* Mobile booking bar */}
      <div className="glass fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-black/5 px-4 py-3 lg:hidden">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">From</p>
          <p className="text-xl font-extrabold">{price ? inr(price) : "On request"}</p>
        </div>
        <div className="flex gap-2">
          <a href="#book" className="press rounded-full border border-line bg-white px-4 py-3 text-sm font-extrabold">Dates</a>
          <OpenLeadButton destination={trip.title} className="press rounded-full bg-brand px-6 py-3 text-sm font-extrabold text-white">Enquire</OpenLeadButton>
        </div>
      </div>
      <div className="h-20 lg:hidden" />
    </>
  );
}

/** JW-style policy grid; scrolls sideways on phones. */
function Policy({ table }: { table: PolicyTable }) {
  return (
    <>
      <div className="overflow-x-auto rounded-3xl border border-line">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-surface">
            <tr>
              <th className="p-4" />
              {table.columns.map((c) => <th key={c} className="p-4 font-extrabold">{c}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {table.rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" className="p-4 font-extrabold">{r.label}</th>
                {r.cells.map((c, i) => <td key={i} className="p-4 text-muted">{c || "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.notes && <div className="prose-admin mt-4 text-sm" dangerouslySetInnerHTML={{ __html: md(table.notes) }} />}
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-line p-5">
      <p className="eyebrow mb-2 text-muted">{label}</p>
      <div className="font-semibold">{children}</div>
    </div>
  );
}

