import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, CalendarDays, Compass, Eye, HeartHandshake, ListChecks, Mail, MessageCircle, Palette, Phone, Sparkles, UserRound, UsersRound, Wind,
} from "lucide-react";
import type { SiteSettings } from "@/lib/site";
import { OpenCustomTrip } from "@/components/CustomTripDialog";

type Category = { slug: string; name: string; trips: number };

const HOW = [
  { icon: CalendarDays, title: "A departure every week", text: "Most trips leave every Friday, so you pick the weekend that suits you and join a group of like-minded travellers." },
  { icon: UserRound, title: "A trip captain on every group", text: "An experienced captain travels with you and handles the plan, the stays and the small details, so you can switch off." },
  { icon: UsersRound, title: "Groups of 8 to 50", text: "Big enough for the party, small enough that nobody gets lost in the crowd." },
  { icon: HeartHandshake, title: "Solo? You're in good company", text: "Many of our travellers join solo and leave with friends." },
  { icon: ListChecks, title: "Everything listed upfront", text: "Stays, travel, sightseeing and meals are written out on every trip page, so you know exactly what you pay for." },
  { icon: Compass, title: "Your trip, your way", text: "Different dates, a private group or a hotel upgrade: tell us and we'll send a quotation." },
];

const VALUES = [
  { icon: UsersRound, title: "Community", text: "You meet a lot of people in a lifetime. We want the ones you meet on our trips to add something real to yours." },
  { icon: HeartHandshake, title: "Looking after travellers", text: "Our founders started out in the same 9-to-5 routine as many of our travellers. We know what a great trip needs to feel like." },
  { icon: Eye, title: "Transparency", text: "Clear prices, clear inclusions, clear policies. Our team, partners and travellers all know exactly what's happening." },
  { icon: Palette, title: "Creativity", text: "When your job is a new adventure every week, the usual way is a setback. Everyone here adds their own spin." },
  { icon: Wind, title: "Freedom from hassles", text: "We take care of the logistics so you get the raw, unplanned joy of travel." },
];

/** /about: designed page (the CMS "about" page still supplies title + SEO). Stats and team come from Settings. */
export function AboutPage({ settings, categories, heroImage, storyImage }: {
  settings: SiteSettings; categories: Category[]; heroImage?: string | null; storyImage?: string | null;
}) {
  const wa = `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent("Hi Travel Devils! I'd like to know more about your trips.")}`;
  const reviews = settings.testimonials.slice(0, 3);
  return (
    <>
      {/* Hero: one clear promise, two next steps */}
      <section className="relative isolate -mt-px overflow-hidden bg-ink text-white">
        {heroImage && <Image src={heroImage} alt="" fill loading="eager" fetchPriority="high" sizes="100vw" className="-z-10 object-cover" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-24 sm:pb-28 sm:pt-32">
          <nav aria-label="Breadcrumb" className="mb-5 flex gap-1.5 text-sm font-semibold text-white/70">
            <Link href="/" className="hover:text-white">Home</Link><span aria-hidden>/</span><span className="text-white">About us</span>
          </nav>
          <p className="eyebrow text-accent">About Travel Devils</p>
          <h1 className="display mt-3 max-w-3xl text-5xl sm:text-6xl lg:text-7xl">Trips that turn into stories.</h1>
          <p className="mt-5 max-w-xl text-lg font-semibold text-white/85">
            Inside jokes, louder laughter, new friendships and stories you&apos;ll tell long after the bags are unpacked. We&apos;re a travel community for people who&apos;d rather be in the mountains than stuck in the 9-to-5 loop.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/upcoming-trips" className="press inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3.5 font-extrabold shadow-lg shadow-brand/30 hover:bg-brand-dark">
              See upcoming trips<ArrowRight className="size-4" aria-hidden />
            </Link>
            <OpenCustomTrip className="press rounded-full bg-white/15 px-6 py-3.5 font-extrabold ring-1 ring-white/30 backdrop-blur hover:bg-white/25">Plan a custom trip</OpenCustomTrip>
          </div>
        </div>
      </section>

      {/* Proof first: the numbers overlap the hero edge so they read as part of the story */}
      {settings.stats.length > 0 && (
        <section aria-label="Travel Devils in numbers" className="relative z-10 mx-auto -mt-12 max-w-6xl px-4">
          <dl className="grid grid-cols-2 overflow-hidden rounded-[2rem] bg-white shadow-[var(--shadow-lift)] ring-1 ring-line lg:grid-cols-4">
            {settings.stats.map((s, i) => (
              <div key={s.label} className={`px-6 py-7 text-center ${i % 2 ? "" : "border-r border-line"} ${i < 2 ? "border-b border-line lg:border-b-0" : ""} ${i < settings.stats.length - 1 ? "lg:border-r" : "lg:border-r-0"}`}>
                <dd className="text-4xl font-extrabold tracking-tight text-brand sm:text-5xl">{s.value}</dd>
                <dt className="mt-1 text-sm font-bold text-muted">{s.label}</dt>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Story */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:py-24 lg:grid-cols-2">
        <div>
          <p className="eyebrow text-brand">Who we are</p>
          <h2 className="headline mt-3 text-3xl sm:text-5xl">A tribe of adventure seekers.</h2>
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-ink/80">
            <p>Travel Devils is a growing tribe exploring the Himalayas and beyond. We design fun, affordable and well-planned trips, whether you&apos;re travelling solo, with friends or with your whole crew.</p>
            <p>College days shape who we become: the values, the dreams and the fire to build something of our own. Those same values brought together a group of travel-obsessed explorers who wanted to change how young India travels. The result is a community people genuinely connect with.</p>
          </div>
          {categories.length > 0 && (
            <ul className="mt-8 flex flex-wrap gap-2" aria-label="What we run">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/${c.slug}`} className="press inline-flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-sm font-bold ring-1 ring-line hover:ring-ink/30">
                    {c.name}{c.trips > 0 && <span className="text-muted">· {c.trips}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        {storyImage && (
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2.5rem] shadow-[var(--shadow-lift)] lg:aspect-[5/6]">
            <Image src={storyImage} alt="On the road with Travel Devils" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
            <div className="absolute inset-x-5 bottom-5 rounded-2xl bg-white/90 p-4 backdrop-blur">
              <p className="flex items-center gap-2 text-sm font-extrabold"><Sparkles className="size-4 text-brand" aria-hidden />Come as a traveller, leave with a squad.</p>
            </div>
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="bg-surface py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4">
          <p className="eyebrow text-brand">How our trips work</p>
          <h2 className="headline mt-3 max-w-2xl text-3xl sm:text-5xl">Show up. We&apos;ve got the rest.</h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HOW.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-[1.75rem] bg-white p-6 ring-1 ring-line">
                <span className="grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand-dark"><Icon className="size-6" aria-hidden /></span>
                <h3 className="headline mt-5 text-lg">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Values: numbered, big type, calm layout */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="eyebrow text-brand">What we value</p>
            <h2 className="headline mt-3 text-3xl sm:text-5xl">The values we travel by.</h2>
          </div>
          <ol className="divide-y divide-line">
            {VALUES.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex gap-5 py-6 first:pt-0">
                <span className="w-10 shrink-0 text-sm font-extrabold tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="flex items-center gap-2 text-xl font-extrabold"><Icon className="size-5 text-brand" aria-hidden />{title}</h3>
                  <p className="mt-1.5 leading-relaxed text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Team: only rendered once Settings has people in it */}
      {settings.team.length > 0 && (
        <section className="bg-ink py-20 text-white sm:py-24">
          <div className="mx-auto max-w-7xl px-4">
            <p className="eyebrow text-accent">The crew</p>
            <h2 className="headline mt-3 text-3xl sm:text-5xl">The people behind your trip.</h2>
            <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {settings.team.map((m) => (
                <li key={m.name} className="overflow-hidden rounded-[1.75rem] bg-white/5 ring-1 ring-white/10">
                  <div className="relative aspect-square bg-white/10">
                    {m.photo
                      ? <Image src={m.photo} alt={m.name} fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" />
                      : <span className="grid size-full place-items-center text-4xl font-extrabold text-white/40" aria-hidden>{m.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>}
                  </div>
                  <div className="p-5">
                    <p className="font-extrabold">{m.name}</p>
                    {m.role && <p className="text-sm font-bold text-accent">{m.role}</p>}
                    {m.bio && <p className="mt-2 text-sm leading-relaxed text-white/70">{m.bio}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Real reviews, if the team has added any in Settings */}
      {reviews.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20">
          <p className="eyebrow text-brand">In their words</p>
          <h2 className="headline mt-3 text-3xl sm:text-4xl">What travellers say.</h2>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {reviews.map((r) => (
              <li key={r.name + r.text.slice(0, 20)} className="rounded-[1.75rem] bg-surface p-6">
                <p className="leading-relaxed">“{r.text}”</p>
                <p className="mt-4 text-sm font-extrabold">{r.name}{r.trip && <span className="font-semibold text-muted"> · {r.trip}</span>}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Close with a way to act */}
      <section className="mx-auto max-w-7xl px-4 pb-20">
        <div className="grid gap-8 overflow-hidden rounded-[2.5rem] bg-brand px-8 py-12 text-white sm:px-12 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <h2 className="headline text-3xl sm:text-4xl">Your next trip starts with a hello.</h2>
            <p className="mt-3 max-w-lg font-semibold text-white/85">Ask us anything about a trip, a date or a custom plan. We&apos;re quick on WhatsApp.</p>
          </div>
          <ul className="grid gap-2 text-sm font-extrabold">
            <li><a href={wa} target="_blank" rel="noopener" className="press flex items-center gap-3 rounded-2xl bg-white px-5 py-3.5 text-ink hover:bg-white/90"><MessageCircle className="size-5 text-[#25D366]" aria-hidden />WhatsApp us</a></li>
            <li><a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="press flex items-center gap-3 rounded-2xl bg-white/15 px-5 py-3.5 ring-1 ring-white/25 hover:bg-white/25"><Phone className="size-5" aria-hidden />{settings.phone}</a></li>
            <li><a href={`mailto:${settings.email}`} className="press flex items-center gap-3 rounded-2xl bg-white/15 px-5 py-3.5 ring-1 ring-white/25 hover:bg-white/25"><Mail className="size-5" aria-hidden />{settings.email}</a></li>
          </ul>
        </div>
      </section>
    </>
  );
}
