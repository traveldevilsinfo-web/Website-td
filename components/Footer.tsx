import Link from "next/link";
import { footerColumns, type ResolvedItem } from "@/lib/nav";
import type { NavLink, SiteSettings } from "@/lib/site";
import { Logo, tel } from "./Header";

export function Footer({ settings, nav, legal }: { settings: SiteSettings; nav: ResolvedItem[]; legal: NavLink[] }) {
  const columns = footerColumns(nav);
  const socials = Object.entries(settings.socials).filter(([, url]) => url);

  return (
    <footer className="mt-auto bg-ink text-white/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Logo dark />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">Community group trips, treks and custom holidays. Come as a traveller, leave with a squad.</p>
          <ul className="mt-5 space-y-1.5 text-sm font-semibold text-white">
            <li><a href={tel(settings.phone)} className="hover:text-brand">{settings.phone}</a></li>
            <li><a href={`mailto:${settings.email}`} className="hover:text-brand">{settings.email}</a></li>
            {settings.address && <li className="whitespace-pre-line font-normal text-white/70">{settings.address}</li>}
          </ul>
          {socials.length > 0 && (
            <ul className="mt-5 flex gap-2">
              {socials.map(([name, url]) => (
                <li key={name}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="press block rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold capitalize text-white hover:border-white/40">{name}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
        {columns.map((c) => (
          <div key={c.title}>
            <p className="eyebrow mb-4 text-white">{c.title}</p>
            <ul className="space-y-2 text-sm">
              {c.links.map((l) => <li key={l.label + l.href}><Link href={l.href} className="hover:text-white">{l.label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Travel Devils. All rights reserved.</p>
          <ul className="flex flex-wrap gap-5">{legal.map((l) => <li key={l.href}><Link href={l.href} className="hover:text-white">{l.label}</Link></li>)}</ul>
        </div>
      </div>
    </footer>
  );
}

export function WhatsAppButton({ number }: { number: string }) {
  const text = encodeURIComponent("Hi Travel Devils, I'd like to plan a trip!");
  return (
    <a href={`https://wa.me/${number}?text=${text}`} target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp"
      className="press fixed bottom-5 right-5 z-30 grid size-14 place-items-center rounded-full bg-[#25d366] text-white shadow-xl shadow-black/20 max-lg:bottom-24">
      <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden>
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.07-.13-.27-.2-.57-.35M12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.89 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41" />
      </svg>
    </a>
  );
}
