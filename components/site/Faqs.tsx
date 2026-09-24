import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { md } from "@/lib/markdown";

type Faq = { q: string; a: string };

/** Accordion list only (trip pages, blog posts). Answers are markdown. Several can be open at once. */
export function FaqList({ items, openFirst }: { items: Faq[]; openFirst?: boolean }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-3xl bg-white ring-1 ring-line">
      {items.map((f, i) => (
        <details key={i} className="acc faq transition-colors open:bg-surface/50" open={openFirst && i === 0}>
          <summary className="flex items-start gap-4 px-5 py-5 text-left text-[17px] font-bold leading-snug transition-colors hover:bg-surface/70 active:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:px-7">
            <span className="flex-1 pt-1">{f.q}</span>
            <span className="faq-icon grid size-8 shrink-0 place-items-center rounded-full bg-surface text-ink" aria-hidden>
              <svg viewBox="0 0 12 12" className="size-3"><path d="M6 1.5v9M1.5 6h9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </span>
          </summary>
          <div className="prose-admin px-5 pb-6 pr-16 text-[16px] text-ink/70 sm:px-7 sm:pr-20 [&>:first-child]:mt-0 [&>:last-child]:mb-0"
            dangerouslySetInnerHTML={{ __html: md(f.a) }} />
        </details>
      ))}
    </div>
  );
}

/** Full FAQ section: title and a "still stuck? ask us" route on the left (sticky), questions on the right. */
export async function Faqs({ items, title = "Questions, answered", cta = true }: { items: Faq[]; title?: string; cta?: boolean }) {
  if (!items.length) return null;
  const { whatsapp } = await getSettings();
  const wa = `https://wa.me/${whatsapp}?text=${encodeURIComponent("Hi Travel Devils! I have a question.")}`;
  const ask = (className: string) => cta && (
    <div className={`flex-wrap gap-2 ${className}`}>
      <a href={wa} target="_blank" rel="noopener" className="press inline-flex items-center gap-2 rounded-full bg-green-700 px-5 py-3 text-sm font-extrabold text-white hover:bg-green-800">
        <MessageCircle className="size-4" aria-hidden />WhatsApp us
      </a>
      <Link href="/contact" className="press inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-extrabold ring-1 ring-line hover:ring-ink/30">Contact us</Link>
    </div>
  );

  return (
    <section className="reveal mx-auto max-w-7xl px-4 py-20">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.75fr)] lg:gap-16">
        <div className="lg:sticky lg:top-[calc(8rem+var(--topbar-h,0px))] lg:self-start">
          <p className="eyebrow text-brand">FAQs</p>
          <h2 className="headline mt-3 text-3xl sm:text-[2.6rem]">{title}</h2>
          {cta && <p className="mt-3 max-w-sm text-muted">Didn&apos;t find your answer? Message us and we&apos;ll help you out.</p>}
          {ask("mt-6 hidden lg:flex")}
        </div>
        <div>
          <FaqList items={items} openFirst />
          {ask("mt-6 flex lg:hidden")}
        </div>
      </div>
    </section>
  );
}
