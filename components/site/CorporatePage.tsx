import Image from "next/image";
import Link from "next/link";
import {
  Award, BriefcaseBusiness, ClipboardList, Handshake, HeartHandshake, Mountain, PartyPopper, Plane, Presentation, ShieldCheck, Sparkles, UsersRound,
} from "lucide-react";
import type { getDestinationsWithTrips, getTrips } from "@/lib/queries";
import { Faqs, SectionHead, TripCard } from "./ui";
import { Rail } from "./Rail";
import { CorporateEnquiry } from "./CorporateEnquiry";

type Dest = Awaited<ReturnType<typeof getDestinationsWithTrips>>[number];

const SERVICES = [
  { icon: Mountain, title: "Corporate offsites", text: "Take your work squad out of the office. Watch spirits lift and results follow." },
  { icon: UsersRound, title: "Team building activities", text: "Bond, laugh, and maybe find out who the real office prankster is." },
  { icon: Plane, title: "Business travel", text: "Smooth trips for meetings, partnerships and expansion, with every booking handled." },
  { icon: Presentation, title: "MICE: meetings, incentives, conferences & exhibitions", text: "From strategy sessions to celebrations, we make every event count." },
  { icon: Award, title: "Incentive tours", text: "Reward your team with trips that inspire, recharge and strengthen bonds beyond work." },
];

const WHY = [
  { icon: ClipboardList, title: "We plan, you play", text: "Your whole trip mapped end to end, so your team enjoys the ride without lifting a finger." },
  { icon: Sparkles, title: "Beyond the ordinary", text: "Experiences that spark real bonding, build confidence and leave your team with memories." },
  { icon: HeartHandshake, title: "Stress-free, start to finish", text: "Travel, stays, activities and meals sorted. Your people just arrive, unwind and explore." },
  { icon: Handshake, title: "A dedicated coordinator", text: "One point of contact from the first call to the last goodbye." },
  { icon: ShieldCheck, title: "Safety first, always", text: "Vetted stays, reliable transport and on-ground support throughout the trip." },
  { icon: PartyPopper, title: "Built around your team", text: "Activities, pace and budget shaped to your company's goals, culture and vibe." },
];

const STEPS = [
  { title: "Share your brief", text: "Team size, dates, budget and what you want the trip to achieve." },
  { title: "Get a proposal", text: "Destination options, a day-wise plan and a clear per-person price." },
  { title: "Fine-tune it", text: "Change hotels, activities or dates until it fits. Then lock it in." },
  { title: "Travel with us", text: "Our coordinator handles everything on the ground while your team has fun." },
];

// Team photos from the corporate page on the old site (picked because no client branding is in frame).
const MOMENTS = ["/uploads/wp/2026/02/3-3.png", "/uploads/wp/2026/02/6-2.png", "/uploads/wp/2026/02/2-3.png"];

const FAQS = [
  { q: "What kinds of corporate trips do you run?", a: "Offsites, team outings and day trips, incentive tours, MICE events (meetings, conferences, award nights) and business travel, across India and abroad." },
  { q: "Can you customise the itinerary and activities?", a: "Yes. Every corporate trip is planned around your brief: destination, dates, hotel category, team-building activities, conference needs and budget." },
  { q: "Do you organise day outings, not just overnight trips?", a: "Yes. Day outings work well for quick team bonding close to the city. Pick “Team outing (day trip)” in the form." },
  { q: "Can you plan international incentive trips?", a: "Yes, for example Thailand, Vietnam or Bali. Tell us your team size and budget and we'll suggest options." },
  { q: "Who looks after the team during the trip?", a: "A dedicated Travel Devils coordinator stays in touch from planning to the trip itself and handles things on the ground." },
];

/** /corporate-trips: landing page for offsites, team outings, incentives and MICE, with an enquiry form. */
export function CorporatePage({ trips, dests, image, whatsapp }: {
  trips: Awaited<ReturnType<typeof getTrips>>; dests: Dest[]; image?: string | null; whatsapp: string;
}) {
  const ideas = dests.filter((d) => d.heroImage || d.cover).slice(0, 8);
  return (
    <>
      <section className="relative isolate -mt-px overflow-hidden bg-ink text-white">
        {image && <Image src={image} alt="" fill loading="eager" fetchPriority="high" sizes="100vw" className="-z-10 object-cover" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/55 to-black/30" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 lg:grid-cols-[1fr_30rem] lg:py-24">
          <div>
            <nav aria-label="Breadcrumb" className="mb-5 flex gap-1.5 text-sm font-semibold text-white/70">
              <Link href="/" className="hover:text-white">Home</Link><span aria-hidden>/</span><span className="text-white">Corporate trips</span>
            </nav>
            <p className="eyebrow text-accent">Corporate trips & offsites</p>
            <h1 className="display mt-3 text-5xl sm:text-6xl lg:text-7xl">Work mode off.<br />Travel mode on.</h1>
            <p className="mt-5 max-w-xl text-lg font-semibold text-white/85">
              Offsites, team outings, incentive trips and MICE that boost team energy, bonding and big ideas. We handle the logistics, planning and travel, so your team just shows up and connects.
            </p>
            <ul className="mt-8 flex flex-wrap gap-2">
              {["Offsites", "Team building", "Incentive tours", "MICE", "Day outings"].map((t) => (
                <li key={t} className="glass-dark rounded-full px-4 py-2 text-sm font-bold ring-1 ring-white/20">{t}</li>
              ))}
            </ul>
          </div>
          <div id="enquiry" className="scroll-mt-32">
            <p className="mb-3 text-center text-sm font-bold text-white/80 lg:text-left">Tell us about your team. We&apos;ll send a proposal.</p>
            <CorporateEnquiry whatsapp={whatsapp} destinations={dests.map((d) => d.name)} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
        <SectionHead eyebrow="What we do" title="Every kind of team trip" subtitle="From a one-day outing to a week-long incentive tour abroad." />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {SERVICES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="card rounded-[1.75rem] bg-surface p-6">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand text-white"><Icon className="size-6" aria-hidden /></span>
              <h3 className="headline mt-5 text-lg leading-snug">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-surface py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <SectionHead eyebrow="Why Travel Devils" title="Your vision, our mission" subtitle="We take care of every detail so you can focus on your team's energy, growth and success." />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHY.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4 rounded-[1.75rem] bg-white p-6">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand-dark"><Icon className="size-5" aria-hidden /></span>
                <div>
                  <h3 className="font-extrabold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
        <SectionHead eyebrow="How it works" title="From brief to boarding in four steps" />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-[1.75rem] border border-line p-6">
              <span className="grid size-10 place-items-center rounded-full bg-ink text-sm font-extrabold text-white">{i + 1}</span>
              <h3 className="headline mt-4 text-lg">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#enquiry" className="press rounded-full bg-brand px-6 py-3.5 font-extrabold text-white shadow-lg shadow-brand/25 hover:bg-brand-dark">Get a proposal</a>
          <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Hi Travel Devils! I'd like to plan a corporate trip for my team.")}`} target="_blank" rel="noopener"
            className="press rounded-full border border-line px-6 py-3.5 font-extrabold hover:border-ink">WhatsApp our corporate team</a>
        </div>
      </section>

      {ideas.length > 0 && (
        <section className="pb-16 sm:pb-20">
          <div className="mx-auto max-w-7xl px-4">
            <SectionHead eyebrow="Offsite ideas" title="Where teams love to go" subtitle="Hills, beaches, heritage cities or abroad. Every destination can be planned as a private team trip." />
          </div>
          <Rail label="Destination ideas" size="card">
            {ideas.map((d) => (
              <Link key={d.slug} href={`/destinations/${d.slug}`} className="card group relative block aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-surface">
                <Image src={(d.heroImage ?? d.cover)!} alt={d.name} fill sizes="(max-width: 640px) 78vw, (max-width: 1024px) 44vw, 300px" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <span className="absolute inset-x-5 bottom-5 text-white">
                  <span className="block text-xl font-extrabold">{d.name}</span>
                  <span className="text-sm font-semibold text-white/80">{d.region === "international" ? "International" : "India"}</span>
                </span>
              </Link>
            ))}
          </Rail>
        </section>
      )}

      {trips.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:pb-20">
          <SectionHead eyebrow="Ready-made packages" title="Corporate packages" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{trips.map((t) => <TripCard key={t.id} trip={t} />)}</div>
        </section>
      )}

      <section className="bg-ink py-16 text-white sm:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <p className="eyebrow text-accent">Moments</p>
          <h2 className="headline mt-2 text-3xl sm:text-4xl">Work trips worth remembering</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {MOMENTS.map((src, i) => (
              <div key={src} className={`relative overflow-hidden rounded-[1.5rem] ${i === 0 ? "col-span-2 aspect-[16/10] sm:col-span-1 sm:aspect-[4/5]" : "aspect-[4/5]"}`}>
                <Image src={src} alt="A team on a corporate trip" fill sizes="(max-width: 640px) 50vw, 33vw" className="object-cover" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <Faqs items={FAQS} title="Corporate trips: questions, answered" />

      <section className="mx-auto max-w-7xl px-4 pb-20">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-[2rem] bg-brand px-8 py-10 text-white sm:px-12">
          <div className="flex items-center gap-4">
            <BriefcaseBusiness className="size-10 shrink-0" aria-hidden />
            <div>
              <h2 className="headline text-2xl sm:text-3xl">Planning your next team trip?</h2>
              <p className="mt-1 font-semibold text-white/80">Share your brief and our corporate team will send ideas and a proposal.</p>
            </div>
          </div>
          <a href="#enquiry" className="press rounded-full bg-white px-7 py-4 font-extrabold text-ink hover:bg-white/90">Get a proposal</a>
        </div>
      </section>
    </>
  );
}
