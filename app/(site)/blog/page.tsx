import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getPosts } from "@/lib/queries";
import { og } from "@/lib/seo";
import { CtaBand, PageHero } from "@/components/site/ui";

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

export default async function BlogIndex() {
  const posts = await getPosts();
  const [lead, ...rest] = posts;
  return (
    <>
      <PageHero title="Stories from the road" intro="Guides, itineraries and honest tips from our trip captains." crumbs={[{ label: "Home", href: "/" }, { label: "Blog" }]} />
      <section className="mx-auto max-w-7xl px-4 py-14">
        {!posts.length && <p className="rounded-[2rem] bg-surface p-12 text-center text-lg font-bold text-muted">First stories are on their way.</p>}
        {lead && (
          <Link href={`/blog/${lead.slug}`} className="card group mb-10 grid overflow-hidden rounded-[2rem] bg-white md:grid-cols-2">
            <div className="relative aspect-[16/10] overflow-hidden bg-surface md:aspect-auto">
              {lead.coverImage && <Image src={lead.coverImage} alt="" fill loading="eager" fetchPriority="high" sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />}
            </div>
            <div className="flex flex-col justify-center p-8 md:p-12">
              {lead.category && <p className="eyebrow text-brand">{lead.category}</p>}
              <h2 className="headline mt-3 text-3xl md:text-4xl">{lead.title}</h2>
              {lead.excerpt && <p className="mt-4 text-lg text-muted">{lead.excerpt}</p>}
              <p className="mt-6 text-sm font-bold text-muted">{lead.publishedAt?.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
          </Link>
        )}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((p) => (
            <Link key={p.id} href={`/blog/${p.slug}`} className="card reveal group overflow-hidden rounded-[1.75rem] bg-white">
              <div className="relative aspect-[16/10] overflow-hidden bg-surface">
                {p.coverImage && <Image src={p.coverImage} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />}
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
      <CtaBand />
    </>
  );
}
