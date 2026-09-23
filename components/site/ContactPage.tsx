import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BriefcaseBusiness, CalendarCheck, Compass, Mail, MessageCircle, Mountain, Phone, PhoneCall,
} from "lucide-react";
import type { SiteSettings } from "@/lib/site";
import { OpenCustomTrip } from "@/components/CustomTripDialog";
import { OpenLeadButton } from "@/components/LeadDialog";
import { Faqs } from "./ui";

// Second line listed on the current traveldevils.in contact page.
const ALT_PHONE = "+91 98117 83209";

const FAQS = [
  { q: "What is Travel Devils?", a: "Travel Devils brings India's travellers together through community-based, experiential trips. From solo adventures to squad getaways, we design journeys that hit both the heart and the bucket list." },
  { q: "Who can join Travel Devils trips?", a: "Anyone! Solo travellers, couples, friends and first-time travellers are all welcome." },
  { q: "Can solo travellers join group trips?", a: "Absolutely. Many of our travellers join solo and make lifelong friends along the way." },
  { q: "What is the group size?", a: "It varies by trip but is usually between 8 and 50 travellers." },
  { q: "What is included in the trip package?", a: "Inclusions typically cover accommodation, transport, sightseeing, a trip captain and select meals. Exact inclusions and exclusions are listed on every trip page." },
  { q: "Is it safe to travel with Travel Devils?", a: "Safety is our top priority. Every trip is led by an experienced trip captain and run with trusted local partners." },
  { q: "Can I customise my trip?", a: "Yes. Both domestic and international trips can be tailored to your dates, group and budget. Use “Plan a custom trip” above." },
  { q: "How do I cancel or change a booking?", a: "Email info@traveldevils.in with your booking ID. Our team will confirm any cancellation charges and refund timelines for your booking." },
];

const tel = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;

/** /contact: fastest channels first, then routes each common reason for getting in touch to the page that handles it. */
export function ContactPage({ settings }: { settings: SiteSettings }) {
  const wa = `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent("Hi Travel Devils! I have a question.")}`;
  // lucide dropped brand logos, so socials are text links
  const socials = ([["instagram", "Instagram"], ["facebook", "Facebook"], ["youtube", "YouTube"], ["linkedin", "LinkedIn"]] as const)
    .filter(([k]) => settings.socials[k]).map(([k, label]) => ({ href: settings.socials[k]!, label }));

  const card = "press group flex h-full flex-col rounded-[1.75rem] bg-white p-6 text-left ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] hover:ring-ink/20";
  const reasons = [
    { icon: Mountain, title: "Book a group trip", text: "See every trip and the next departures.", href: "/upcoming-trips", cta: "Browse trips" },
    { icon: Compass, title: "Plan a custom trip", text: "Your dates, group and hotel category. Get a quotation.", custom: true, cta: "Open trip planner" },
    { icon: BriefcaseBusiness, title: "Corporate trip or offsite", text: "Offsites, team outings, incentives and MICE.", href: "/corporate-trips", cta: "Get a proposal" },
    { icon: CalendarCheck, title: "Already booked?", text: "See your booking, payments and pay the balance.", href: "/account", cta: "My bookings" },
    { icon: PhoneCall, title: "Request a call back", text: "Leave your number and a travel expert will call you.", lead: true, cta: "Request a call" },
  ];

  return (
    <>
      <section className="bg-surface">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:pb-20 sm:pt-16">
          <nav aria-label="Breadcrumb" className="mb-5 flex gap-1.5 text-sm font-semibold text-muted">
            <Link href="/" className="hover:text-ink">Home</Link><span aria-hidden>/</span><span className="text-ink">Contact us</span>
          </nav>
          <p className="eyebrow text-brand">Contact us</p>
          <h1 className="display mt-3 max-w-3xl text-5xl sm:text-6xl">We&apos;re a message away.</h1>
          <p className="mt-4 max-w-xl text-lg font-semibold text-muted">Planning a trip, got a question about a booking, or want a quote for your group? WhatsApp is the fastest way to reach us.</p>

          {/* Channels: fastest first */}
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            <li>
              <a href={wa} target="_blank" rel="noopener" className="press group flex h-full flex-col justify-between gap-8 rounded-[2rem] bg-green-700 p-7 text-white shadow-lg shadow-green-700/25 hover:bg-green-800 transition hover:-translate-y-0.5">
                <span className="flex items-center justify-between">
                  <MessageCircle className="size-9" aria-hidden />
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-extrabold">Fastest reply</span>
                </span>
                <span>
                  <span className="block text-2xl font-extrabold">WhatsApp us</span>
                  <span className="mt-1 flex items-center gap-1.5 font-bold text-white/90">{settings.phone}<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden /></span>
                </span>
              </a>
            </li>
            <li className="flex flex-col justify-between gap-8 rounded-[2rem] bg-white p-7 ring-1 ring-line">
              <Phone className="size-9 text-brand" aria-hidden />
              <span>
                <span className="block text-2xl font-extrabold">Call us</span>
                <a href={tel(settings.phone)} className="mt-1 block font-bold text-ink hover:text-brand">{settings.phone}</a>
                <a href={tel(ALT_PHONE)} className="block font-bold text-muted hover:text-brand">{ALT_PHONE}</a>
              </span>
            </li>
            <li>
              <a href={`mailto:${settings.email}`} className="press group flex h-full flex-col justify-between gap-8 rounded-[2rem] bg-white p-7 ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-ink/20">
                <Mail className="size-9 text-brand" aria-hidden />
                <span>
                  <span className="block text-2xl font-extrabold">Email us</span>
                  <span className="mt-1 flex items-center gap-1.5 font-bold text-ink group-hover:text-brand">{settings.email}<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden /></span>
                </span>
              </a>
            </li>
          </ul>
        </div>
      </section>

      {/* Route by intent */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
        <h2 className="headline text-3xl sm:text-4xl">What can we help with?</h2>
        <p className="mt-2 text-muted">Pick what you need and we&apos;ll take you straight there.</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {reasons.map(({ icon: Icon, title, text, href, custom, lead, cta }) => {
            const inner = (
              <>
                <span className="grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand-dark"><Icon className="size-6" aria-hidden /></span>
                <span className="mt-5 block text-lg font-extrabold leading-snug">{title}</span>
                <span className="mt-1 block flex-1 text-sm leading-relaxed text-muted">{text}</span>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-extrabold text-brand-dark">{cta}<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden /></span>
              </>
            );
            return (
              <li key={title}>
                {href ? <Link href={href} className={card}>{inner}</Link>
                  : custom ? <OpenCustomTrip className={card}>{inner}</OpenCustomTrip>
                  : lead ? <OpenLeadButton className={card}>{inner}</OpenLeadButton> : null}
              </li>
            );
          })}
        </ul>
      </section>

      {socials.length > 0 && (
        <section className="mx-auto max-w-7xl px-4">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] bg-ink px-7 py-6 text-white">
            <p className="text-lg font-extrabold">Follow the journey</p>
            <ul className="flex flex-wrap gap-2">
              {socials.map(({ href, label }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener" className="press flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-bold ring-1 ring-white/15 hover:bg-white/20">
                    {label}<ArrowUpRight className="size-4" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <Faqs items={FAQS} />
    </>
  );
}
