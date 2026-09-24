import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { COLLECTIONS, inr } from "@/lib/format";
import { getCategories, getDestinationsWithTrips, getPosts, getTrips } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { og } from "@/lib/seo";
import { Hero } from "@/components/site/Hero";
import { Rail } from "@/components/site/Rail";
import { UpcomingTabs } from "@/components/site/UpcomingTabs";
import { CtaBand, SectionHead, TripCard } from "@/components/site/ui";
import { Faqs } from "@/components/site/Faqs";
import { TripAccordion } from "@/components/site/TripAccordion";
import { Reels } from "@/components/site/Reels";
import { LISTINGS, mapsUrl, postalAddress } from "@/lib/site";

export const revalidate = 300;

export const metadata: Metadata = {
  description: "Group trips, Himalayan treks, weekend getaways from Delhi and international tours with weekly departures. Small groups, trip captains, all-inclusive packages.",
  alternates: { canonical: "/" },
  openGraph: og({ url: "/", title: "Travel Devils | Group Trips, Treks & Tour Packages" }),
};

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const STYLES = [
  { title: "Mountain escapes", text: "Weekend trips, treks and Himachal–Uttarakhand group tours.", href: "/weekend-getaways", emoji: "🏔️" },
  { title: "Adventure", text: "Paragliding, rafting, trekking, camping under the stars.", href: "/backpacking-trips", emoji: "🪂" },
  { title: "Community vibes", text: "Bonfires, games and a squad you'll keep for life.", href: "/upcoming-trips", emoji: "🔥" },
  { title: "International", text: "Thailand, Vietnam, Bali and beyond, the Travel Devils way.", href: "/international-trips", emoji: "✈️" },
  { title: "Customised trips", text: "Your dates, your group, your style. Tailor-made for you.", href: "#plan-my-trip", emoji: "🧭" },
];

const WHY = [
  { title: "Trip captains who care", text: "Every group travels with an experienced captain who handles the details so you can switch off." },
  { title: "Safety first, always", text: "Vetted stays, verified transport and local partners on every route." },
  { title: "Solo? You're in good company", text: "Most of our travellers join solo and leave with friends. Group sizes stay between 8 and 50." },
  { title: "All-inclusive, no surprises", text: "Stays, travel, sightseeing and meals are listed upfront, so you know exactly what you pay for." },
];

const Tile = ({ href, ...rest }: { href: string; className: string; children: React.ReactNode }) =>
  href.startsWith("#") ? <a href={href} {...rest} /> : <Link href={href} {...rest} />;

export default async function Home() {
  const [settings, trips, cats, dests, posts] = await Promise.all([
    getSettings(), getTrips(), getCategories(), getDestinationsWithTrips(), getPosts(3),
  ]);

  const slides = settings.heroSlides.length
    ? settings.heroSlides
    : dests.filter((d) => d.cover).slice(0, 4).map((d) => ({ image: d.cover!, place: d.name }));

  // Upcoming: trips with departures (sorted by next date); fall back to all trips if none scheduled yet.
  const scheduled = trips.filter((t) => t.batches.length).sort((a, b) => a.batches[0].start.localeCompare(b.batches[0].start));
  const upcoming = scheduled.length ? scheduled : trips;
  const months = [...new Set(scheduled.flatMap((t) => t.batches.map((b) => b.start.slice(0, 7))))].sort().slice(0, 8)
    .map((key, _, all) => ({ key, label: new Date(key + "-01T00:00:00").toLocaleString("en-IN", { month: "short" }) + (key.slice(0, 4) !== all[0].slice(0, 4) ? ` ’${key.slice(2, 4)}` : "") }));

  const rails = cats.map((c) => ({ cat: c, trips: trips.filter((t) => t.categorySlug === c.slug) })).filter((r) => r.trips.length);

  // Brand entity for Google / AI answers: who we are, how to reach us, where we're listed.
  const sameAs = [...Object.values(settings.socials).filter(Boolean), LISTINGS.justdial, LISTINGS.linkedin];
  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "TravelAgency", "@id": `${SITE}/#org`, name: "Travel Devils", url: SITE,
      logo: `${SITE}/logo.png`, image: `${SITE}/logo.png`, telephone: settings.phone || undefined, email: settings.email || undefined,
      ...(settings.address && { address: postalAddress(settings.address), hasMap: mapsUrl(settings.address) }), sameAs,
      areaServed: ["Delhi", "Ghaziabad", "Noida", "Gurugram", "Faridabad"].map((name) => ({ "@type": "City", name })),
      contactPoint: settings.phone ? { "@type": "ContactPoint", telephone: settings.phone, contactType: "customer service", areaServed: "IN", availableLanguage: ["en", "hi"] } : undefined,
    },
    { "@context": "https://schema.org", "@type": "WebSite", "@id": `${SITE}/#website`, name: "Travel Devils", url: SITE, publisher: { "@id": `${SITE}/#org` }, inLanguage: "en-IN" },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Hero copy={settings.hero} slides={slides} stats={settings.stats}
        popular={dests.slice(0, 6).map((d) => ({ label: d.name, href: `/destinations/${d.slug}`, image: d.heroImage ?? d.cover, meta: `${d.trips} trip${d.trips === 1 ? "" : "s"}` }))} />

      {/* Quick chips, like JW's filter row */}
      <nav aria-label="Browse" className="border-b border-line bg-white">
        <div className="rail mx-auto max-w-7xl gap-2 py-4 [grid-auto-columns:max-content]">
          {rails.map(({ cat }) => (
            <Link key={cat.slug} href={`/${cat.slug}`} className="press rounded-full bg-surface px-5 py-2.5 text-sm font-extrabold hover:bg-line">{cat.name}</Link>
          ))}
          <Link href="/upcoming-trips" className="press rounded-full bg-surface px-5 py-2.5 text-sm font-extrabold hover:bg-line">Upcoming</Link>
          {Object.entries(COLLECTIONS).map(([slug, c]) => (
            <Link key={slug} href={`/${slug}`} className="press rounded-full bg-surface px-5 py-2.5 text-sm font-extrabold hover:bg-line">{c.title}</Link>
          ))}
        </div>
      </nav>

      <section className="pt-20">
        <SectionHead eyebrow="Pack your bags" title={scheduled.length ? "Upcoming group trips" : "Trips we love"}
          subtitle="Fixed departures with a crew of like-minded travellers. Pick a month and go." href="/upcoming-trips" />
        <UpcomingTabs trips={upcoming} months={months} />
      </section>

      {settings.reels.length > 0 && (
        <section className="reveal pt-24">
          <div className="mx-auto mb-10 max-w-2xl px-4 text-center">
            <p className="eyebrow text-brand">On Instagram</p>
            <h2 className="headline mt-2 text-3xl sm:text-[2.6rem]">Straight from our trips</h2>
            <p className="mt-3 text-muted">Real moments from real departures. Tap a reel to play it.</p>
          </div>
          <Reels reels={settings.reels} />
          {settings.socials.instagram && (
            <p className="mt-6 text-center">
              <a href={settings.socials.instagram} target="_blank" rel="noopener" className="press inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-extrabold text-white hover:bg-black">
                Follow @{settings.socials.instagram.replace(/\/$/, "").split("/").pop()} on Instagram
              </a>
            </p>
          )}
        </section>
      )}

      {rails.map(({ cat, trips: list }) => (
        <section key={cat.id} className="reveal pt-16">
          <SectionHead title={cat.name} subtitle={cat.intro ?? undefined} href={`/${cat.slug}`} />
          {cat.slug === "international-trips"
            ? <TripAccordion trips={list} />
            : <Rail label={cat.name}>{list.map((t) => <TripCard key={t.id} trip={t} />)}</Rail>}
        </section>
      ))}

      {/* Travel styles: bento */}
      <section className="reveal mx-auto max-w-7xl px-4 pt-24">
        <p className="eyebrow mb-2 text-brand">Discover your travel style</p>
        <h2 className="headline mb-10 max-w-2xl text-3xl sm:text-[2.6rem]">However you like to travel, there&apos;s a trip for you.</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STYLES.map((s, i) => (
            // "#…" opens the Plan my trip questionnaire, which needs a real hashchange, so a plain <a>
            <Tile key={s.title} href={s.href}
              className={`card press group flex flex-col justify-between rounded-[1.75rem] p-6 ${i === 0 ? "bg-ink text-white lg:col-span-2 lg:row-span-2" : "bg-surface"}`}>
              <span className={`text-4xl ${i === 0 ? "lg:text-6xl" : ""}`} aria-hidden>{s.emoji}</span>
              <div className="mt-10">
                <h3 className={`headline ${i === 0 ? "text-3xl lg:text-4xl" : "text-xl"}`}>{s.title}</h3>
                <p className={`mt-2 text-sm leading-relaxed ${i === 0 ? "text-white/70 lg:text-base" : "text-muted"}`}>{s.text}</p>
              </div>
            </Tile>
          ))}
        </div>
      </section>

      {/* Destinations bento */}
      {dests.length > 0 && (
        <section className="reveal pt-24">
          <SectionHead eyebrow="Where to next" title="Popular destinations" subtitle="Group departures and custom packages across India and abroad." />
          <div className="mx-auto grid max-w-7xl auto-rows-[200px] grid-cols-2 gap-4 px-4 md:auto-rows-[220px] md:grid-cols-4">
            {dests.slice(0, 7).map((d, i) => (
              <Link key={d.slug} href={`/destinations/${d.slug}`}
                className={`card group relative overflow-hidden rounded-[1.75rem] bg-surface ${i === 0 ? "col-span-2 row-span-2" : ""} ${i === 3 ? "md:col-span-2" : ""}`}>
                {(d.heroImage ?? d.cover) && <Image src={(d.heroImage ?? d.cover)!} alt={d.name} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
                <div className="absolute inset-x-5 bottom-5 text-white">
                  <h3 className={`headline ${i === 0 ? "text-4xl" : "text-2xl"}`}>{d.name}</h3>
                  <p className="text-sm font-semibold text-white/80">{d.trips} trip{d.trips > 1 ? "s" : ""}{d.fromPrice ? ` · from ${inr(d.fromPrice)}` : ""}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Why */}
      <section className="reveal mt-24 bg-surface py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="eyebrow mb-2 text-brand">Why Travel Devils</p>
            <h2 className="headline text-3xl sm:text-[2.6rem]">Trips that feel like they were planned by your most organised friend.</h2>
            <dl className="mt-10 grid grid-cols-2 gap-6">
              {settings.stats.map((s) => (
                <div key={s.label}><dd className="text-4xl font-extrabold tracking-tight text-brand">{s.value}</dd><dt className="text-sm font-bold text-muted">{s.label}</dt></div>
              ))}
            </dl>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {WHY.map((w, i) => (
              <div key={w.title} className="rounded-[1.75rem] bg-white p-7 shadow-[var(--shadow-card)]">
                <span className="grid size-10 place-items-center rounded-full bg-brand text-sm font-extrabold text-white">{i + 1}</span>
                <h3 className="headline mt-5 text-xl">{w.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{w.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      {settings.testimonials.length > 0 && (
        <section className="reveal pt-24">
          <SectionHead eyebrow="Straight from the squad" title="What travellers say"
            href={settings.reviewsUrl || undefined} hrefLabel="Read Google reviews" />
          <Rail label="Testimonials" size="quote">
            {settings.testimonials.map((t) => (
              <figure key={t.name} className="flex h-full flex-col justify-between rounded-[1.75rem] border border-line bg-white p-7">
                <div>
                  <p className="text-accent" aria-label="5 stars">★★★★★</p>
                  <blockquote className="mt-4 text-lg font-semibold leading-relaxed">“{t.text}”</blockquote>
                </div>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-full bg-brand/10 font-extrabold text-brand">{t.name[0]}</span>
                  <span><span className="block font-extrabold">{t.name}</span>{t.trip && <span className="text-sm text-muted">{t.trip} trip</span>}</span>
                </figcaption>
              </figure>
            ))}
          </Rail>
        </section>
      )}

      {/* Blog */}
      {posts.length > 0 && (
        <section className="reveal pt-24">
          <SectionHead eyebrow="Travel stories" title="From the blog" href="/blog" />
          <div className="mx-auto grid max-w-7xl gap-6 px-4 md:grid-cols-3">
            {posts.map((p) => (
              <Link key={p.id} href={`/blog/${p.slug}`} className="card group overflow-hidden rounded-[1.75rem] bg-white">
                <div className="relative aspect-[16/10] overflow-hidden bg-surface">
                  {p.coverImage && <Image src={p.coverImage} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />}
                </div>
                <div className="p-6">
                  {p.category && <p className="eyebrow text-brand">{p.category}</p>}
                  <h3 className="headline mt-2 text-xl">{p.title}</h3>
                  {p.excerpt && <p className="mt-2 line-clamp-2 text-muted">{p.excerpt}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Faqs items={settings.faqs} />
      <CtaBand />
    </>
  );
}
