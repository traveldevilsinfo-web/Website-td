import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, PenLine } from "lucide-react";
import { getPosts, getTrips } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { BlogCard } from "@/components/site/BlogCard";
import { og } from "@/lib/seo";
import { CtaBand, TripCard } from "@/components/site/ui";

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> {
  const any = (await getPosts(1)).length > 0;
  return {
    title: "Travel Blog",
    description: "Travel guides, itineraries and honest tips from Travel Devils trip captains: best time to visit, costs, packing lists and routes across India and abroad.",
    alternates: { canonical: "/blog" },
    openGraph: og({ title: "Travel Blog | Travel Devils", url: "/blog" }),
    ...(!any && { robots: { index: false, follow: true } }), // no posts yet: keep the empty page out of Google
  };
}

export default async function BlogIndex({ searchParams }: PageProps<"/blog">) {
  const raw = (await searchParams).category;
  const [all, settings, trips] = await Promise.all([getPosts(), getSettings(), getTrips({ limit: 2 })]);
  const categories = [...new Set(all.map((p) => p.category).filter((c): c is string => !!c))].sort();
  const active = typeof raw === "string" && categories.includes(raw) ? raw : "";
  const posts = active ? all.filter((p) => p.category === active) : all;
  const [lead, ...rest] = posts;
  const chip = (on: boolean) => `press whitespace-nowrap rounded-full px-4 py-2 text-sm font-extrabold transition-colors ${on ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-line hover:ring-ink/30"}`;

  return (
    <>
      <section className="bg-surface">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-12 sm:pt-16">
          <nav aria-label="Breadcrumb" className="mb-5 flex gap-1.5 text-sm font-semibold text-muted">
            <Link href="/" className="hover:text-ink">Home</Link><span aria-hidden>/</span><span className="text-ink">Blog</span>
          </nav>
          <p className="eyebrow text-brand">The Travel Devils blog</p>
          <h1 className="display mt-3 max-w-3xl text-5xl sm:text-6xl">Stories from the road.</h1>
          <p className="mt-4 max-w-xl text-lg font-semibold text-muted">Guides, itineraries and honest tips from our trip captains: when to go, what it costs and what to pack.</p>
          {categories.length > 1 && (
            <nav aria-label="Blog categories" className="rail mt-8 gap-2 [grid-auto-columns:max-content]">
              <Link href="/blog" aria-current={!active ? "page" : undefined} className={chip(!active)}>All stories</Link>
              {categories.map((c) => (
                <Link key={c} href={`/blog?category=${encodeURIComponent(c)}`} aria-current={active === c ? "page" : undefined} className={chip(active === c)}>{c}</Link>
              ))}
            </nav>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
        {lead ? (
          <>
            <BlogCard post={lead} lead priority />
            {rest.length > 0 && (
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((p) => <BlogCard key={p.id} post={p} />)}
              </div>
            )}
          </>
        ) : (
          // Empty state: say what's coming and give readers somewhere useful to go
          <div className="grid items-center gap-10 rounded-[2.5rem] bg-surface p-8 sm:p-12 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <span className="grid size-14 place-items-center rounded-2xl bg-brand text-white"><PenLine className="size-7" aria-hidden /></span>
              <h2 className="headline mt-6 text-3xl sm:text-4xl">First stories are on their way.</h2>
              <p className="mt-3 text-lg text-muted">Our trip captains are writing guides to Spiti, Kashmir, Meghalaya and more. Meanwhile, see where we&apos;re headed next.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/upcoming-trips" className="press inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3.5 font-extrabold text-white hover:bg-brand-dark">See upcoming trips<ArrowRight className="size-4" aria-hidden /></Link>
                {settings.socials.instagram && (
                  <a href={settings.socials.instagram} target="_blank" rel="noopener" className="press inline-flex items-center gap-1.5 rounded-full bg-white px-6 py-3.5 font-extrabold ring-1 ring-line hover:ring-ink/30">Follow on Instagram<ArrowUpRight className="size-4" aria-hidden /></a>
                )}
              </div>
            </div>
            {trips.length > 0 && (
              <div className="grid grid-cols-2 gap-4">{trips.map((t) => <TripCard key={t.id} trip={t} />)}</div>
            )}
          </div>
        )}
      </section>
      <CtaBand />
    </>
  );
}
