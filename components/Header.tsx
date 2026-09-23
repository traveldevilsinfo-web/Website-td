import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Phone, UserRound } from "lucide-react";
import type { ResolvedItem } from "@/lib/nav";
import type { SiteSettings } from "@/lib/site";
import { OpenLeadButton } from "./LeadDialog";
import { MobileMenu } from "./MobileMenu";
import { TopBar } from "./TopBar";
import { MegaPanel } from "./nav/MegaMenu";
import { Badge, NavIcon } from "./nav/NavIcon";
import { SearchButton } from "./nav/SearchButton";
import logo from "@/public/logo.png";
import icon from "@/app/icon.png";

/** Enabled, has messages, and inside its optional start/end window. */
function topBarLive(b: SiteSettings["topBar"]) {
  const now = Date.now();
  return b.enabled && b.messages.length > 0
    && (!b.startsAt || Date.parse(b.startsAt) <= now)
    && (!b.endsAt || Date.parse(b.endsAt) > now);
}

export const tel = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;

/** light = full logo (white background); dark = icon + wordmark for dark surfaces. */
export function Logo({ dark }: { dark?: boolean }) {
  return (
    <Link href="/" aria-label="Travel Devils home" className="press flex shrink-0 items-center gap-2">
      {dark ? (
        <>
          <Image src={icon} alt="" sizes="40px" className="h-10 w-auto" />
          <span className="text-xl font-extrabold lowercase tracking-tight text-white">travel <span className="text-brand">devils.</span></span>
        </>
      ) : (
        <Image src={logo} alt="Travel Devils" priority sizes="120px" className="h-10 w-auto sm:h-11" />
      )}
    </Link>
  );
}

const trigger = "press flex items-center gap-1 rounded-full px-3 py-2 text-[15px] font-bold text-ink/80 group-hover:bg-black/5 group-hover:text-ink";
const Chev = () => <ChevronDown className="size-4 transition-transform duration-300 group-hover:rotate-180" aria-hidden />;

function DesktopItem({ item }: { item: ResolvedItem }) {
  switch (item.type) {
    case "link":
      return <Link href={item.href} className="press rounded-full px-3 py-2 text-[15px] font-bold text-ink/80 hover:bg-black/5 hover:text-ink">{item.label}</Link>;
    case "highlight":
      return (
        <Link href={item.href} className="press ml-1 flex items-center gap-2 rounded-full border-2 border-green-600 py-1 pl-3.5 pr-1.5 text-sm font-extrabold text-green-700 hover:bg-green-50">
          {item.label}
          {item.badge && (
            <span className="relative flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] uppercase text-white">
              <span className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden />{item.badge}
            </span>
          )}
        </Link>
      );
    case "mega":
      // `static` so the panel spans the header container instead of the trigger.
      return (
        <div className="group static">
          <button type="button" className={trigger} aria-haspopup="true">{item.label} <Chev /></button>
          <div className="menu-panel mega absolute inset-x-4 top-full z-50 pt-2">
            <div className="glass-panel mx-auto max-w-7xl overflow-hidden rounded-3xl border border-black/5 shadow-[var(--shadow-lift)]">
              <MegaPanel tabs={item.tabs} />
            </div>
          </div>
        </div>
      );
    case "dropdown":
      return (
        <div className="group relative">
          <button type="button" className={trigger} aria-haspopup="true">{item.label} <Chev /></button>
          <div className="menu-panel absolute left-0 top-full z-50 w-80 pt-2">
            <ul className="glass-panel space-y-1 rounded-3xl border border-black/5 p-3 shadow-[var(--shadow-lift)]">
              {item.links.map((l) => (
                <li key={l.label}>
                  {l.children.length ? (
                    <details className="acc rounded-2xl hover:bg-surface">
                      <summary className="flex items-center gap-3 p-2.5">
                        <NavIcon name={l.icon} color={l.color} />
                        <DropText l={l} />
                        <ChevronDown className="chev ml-auto size-4 text-muted" aria-hidden />
                      </summary>
                      <ul className="pb-2 pl-[3.75rem]">
                        {l.href && <li><Link href={l.href} className="block py-1.5 text-sm font-bold text-brand">View all →</Link></li>}
                        {l.children.map((c) => <li key={c.href}><Link href={c.href} className="block py-1.5 text-sm font-semibold hover:text-brand">{c.label}</Link></li>)}
                      </ul>
                    </details>
                  ) : (
                    <Link href={l.href || "#"} className="flex items-center gap-3 rounded-2xl p-2.5 hover:bg-surface">
                      <NavIcon name={l.icon} color={l.color} />
                      <DropText l={l} />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
  }
}

function DropText({ l }: { l: { label: string; subtitle: string; badge: string } }) {
  return (
    <span className="min-w-0">
      <span className="flex items-center gap-2 text-[15px] font-extrabold">{l.label}{l.badge && <Badge>{l.badge}</Badge>}</span>
      {l.subtitle && <span className="block text-[13px] text-muted">{l.subtitle}</span>}
    </span>
  );
}

export function Header({ settings, nav }: { settings: SiteSettings; nav: ResolvedItem[] }) {
  const suggestions = nav.flatMap((i) => (i.type === "mega" ? i.tabs.flatMap((tb) => [...tb.india, ...tb.world]) : []))
    .filter((d, i, a) => a.findIndex((x) => x.name === d.name) === i).slice(0, 8)
    .map((d) => ({ label: d.name, href: d.href }));

  return (
    <header className="glass-bar sticky top-0 z-40">
      {topBarLive(settings.topBar) && (
        <>
          {/* Lets sticky elements below the header account for the bar's height. */}
          <style>{`:root{--topbar-h:2.25rem}@media(min-width:640px){:root{--topbar-h:2.625rem}}`}</style>
          <TopBar messages={settings.topBar.messages} bg={settings.topBar.bg} fg={settings.topBar.fg} />
        </>
      )}
      <div className="relative mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:h-[4.5rem]">
        <Logo />

        <nav aria-label="Main" className="hidden flex-1 items-center justify-center gap-0.5 lg:flex">
          {nav.map((item) => <DesktopItem key={item.label} item={item} />)}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <a href={tel(settings.phone)} className="press hidden items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-black/5 xl:flex">
            <span className="grid size-9 place-items-center rounded-full bg-surface text-ink"><Phone className="size-4" aria-hidden /></span>
            <span className="leading-tight"><span className="block text-xs font-semibold text-muted">Call us</span><span className="text-sm font-extrabold">{settings.phone}</span></span>
          </a>
          <SearchButton suggestions={suggestions} />
          <Link href="/account" aria-label="My bookings" title="My bookings"
            className="press grid size-10 place-items-center rounded-full bg-ink text-white hover:bg-black">
            <UserRound className="size-[18px]" strokeWidth={2.5} />
          </Link>
          <OpenLeadButton className="press hidden rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white hover:bg-black sm:block">
            Plan my trip
          </OpenLeadButton>

          <MobileMenu className="lg:hidden">
            <summary aria-label="Menu" className="press grid size-10 cursor-pointer list-none place-items-center rounded-full hover:bg-black/5 [&::-webkit-details-marker]:hidden">
              <svg viewBox="0 0 24 24" className="size-6" aria-hidden><path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </summary>
            <div className="absolute inset-x-0 top-full h-[calc(100dvh-4rem-var(--topbar-h,0px))] overflow-y-auto bg-white px-5 pb-10 pt-2">
              {nav.map((item) => <MobileItem key={item.label} item={item} />)}
              <div className="mt-6 grid gap-3">
                <OpenLeadButton className="press rounded-2xl bg-brand py-4 text-lg font-extrabold text-white">Plan my trip</OpenLeadButton>
                <a href={tel(settings.phone)} className="press rounded-2xl border border-line py-4 text-center text-lg font-extrabold">Call {settings.phone}</a>
              </div>
            </div>
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}

function MobileItem({ item }: { item: ResolvedItem }) {
  const row = "flex items-center justify-between py-4 text-lg font-extrabold";
  const chev = <ChevronDown className="chev size-5 text-muted" aria-hidden />;
  switch (item.type) {
    case "link":
      return <Link href={item.href} className={`${row} border-b border-line`}>{item.label}</Link>;
    case "highlight":
      return <Link href={item.href} className={`${row} border-b border-line text-green-700`}>{item.label}{item.badge && <Badge>{item.badge}</Badge>}</Link>;
    case "dropdown":
      return (
        <details className="acc border-b border-line">
          <summary className={row}>{item.label}{chev}</summary>
          <div className="space-y-1 pb-4">
            {item.links.map((l) => (
              <div key={l.label}>
                <Link href={l.href || "#"} className="flex items-center gap-3 rounded-2xl p-2">
                  <NavIcon name={l.icon} color={l.color} size="sm" /><DropText l={l} />
                </Link>
                {l.children.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-2 pl-12">
                    {l.children.map((c) => <Link key={c.href} href={c.href} className="rounded-full bg-surface px-3 py-1.5 text-sm font-bold">{c.label}</Link>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
      );
    case "mega":
      return (
        <details className="acc border-b border-line">
          <summary className={row}>{item.label}{chev}</summary>
          <div className="space-y-2 pb-4">
            {item.tabs.map((tb) => (
              <details key={tb.title} className="acc rounded-2xl bg-surface">
                <summary className="flex items-center gap-3 p-3">
                  <NavIcon name={tb.icon} color={tb.color} size="sm" />
                  <span className="min-w-0 flex-1"><span className="block font-extrabold">{tb.title}</span>{tb.subtitle && <span className="block text-xs text-muted">{tb.subtitle}</span>}</span>
                  {chev}
                </summary>
                <div className="px-3 pb-3">
                  {[...tb.india, ...tb.world].length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {[...tb.india, ...tb.world].slice(0, 9).map((d) => (
                        <Link key={d.href} href={d.href} className="relative aspect-square overflow-hidden rounded-xl bg-line">
                          {d.image && <Image src={d.image} alt="" fill sizes="30vw" className="object-cover" />}
                          <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                          <span className="absolute inset-x-1 bottom-1 text-center text-[11px] font-extrabold text-white">{d.name}</span>
                        </Link>
                      ))}
                    </div>
                  ) : <p className="py-2 text-sm text-muted">New routes coming soon.</p>}
                  {tb.list.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tb.list.map((l) => <Link key={l.label} href={l.href || "#"} className="rounded-full bg-white px-3 py-1.5 text-sm font-bold">{l.label}{l.badge && ` · ${l.badge}`}</Link>)}
                    </div>
                  )}
                  {tb.href && <Link href={tb.href} className="mt-3 block text-sm font-extrabold text-brand">View all {tb.title} →</Link>}
                </div>
              </details>
            ))}
          </div>
        </details>
      );
  }
}
