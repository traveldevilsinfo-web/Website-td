import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { md } from "@/lib/markdown";
import { og } from "@/lib/seo";
import { eq } from "drizzle-orm";
import { ArrowRight, MessageCircle } from "lucide-react";
import { db, t } from "@/lib/db";
import { splitFaqs, tripsForPost, withHeadingIds } from "@/lib/blog";
import { getPost, getPosts, getTrips } from "@/lib/queries";
import { BlogCard, BlogMeta } from "@/components/site/BlogCard";
import { ShareButton } from "@/components/site/TripClient";
import { CtaBand, TripCard } from "@/components/site/ui";
import { FaqList } from "@/components/site/Faqs";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const p = await getPost((await params).slug);
  if (!p) return {};
  return {
    title: p.seo.title || p.title, description: p.seo.description || p.excerpt || undefined,
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: { ...og({ title: p.seo.title || p.title, description: p.seo.description || p.excerpt || undefined, url: `/blog/${p.slug}`, image: p.seo.ogImage || p.coverImage }), type: "article" },
  };
}

export default async function BlogPost({ params }: PageProps<"/blog/[slug]">) {
  const post = await getPost((await params).slug);
  if (!post) notFound();
  const [all, trips, author] = await Promise.all([
    getPosts(), getTrips(),
    post.authorId ? db.select({ name: t.users.name }).from(t.users).where(eq(t.users.id, post.authorId)).then((r) => r[0]?.name ?? null) : null,
  ]);
  // Same category first, then the newest.
  const more = [...all.filter((p) => p.id !== post.id && p.category && p.category === post.category), ...all.filter((p) => p.id !== post.id)]
    .filter((p, i, a) => a.indexOf(p) === i).slice(0, 3);
  const related = tripsForPost(post, trips);
  // "## FAQs" becomes an accordion between the text before and after it; the contents list keeps its order.
  const faq = splitFaqs(post.content);
  const head = withHeadingIds(md(faq ? faq.before : post.content));
  const tail = faq ? withHeadingIds(md(faq.after)) : null;
  const toc = [...head.toc, ...(faq ? [{ id: "faqs", text: faq.title }] : []), ...(tail?.toc ?? [])];
  const by = author && !/admin/i.test(author) ? author : "Travel Devils team";

  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const url = `${site}/blog/${post.slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, description: post.excerpt ?? undefined, url,
      image: post.coverImage ? [post.coverImage.startsWith("http") ? post.coverImage : site + post.coverImage] : undefined,
      datePublished: post.publishedAt?.toISOString(), dateModified: post.updatedAt.toISOString(),
      author: { "@type": author && !/admin/i.test(author) ? "Person" : "Organization", name: by },
      publisher: { "@type": "TravelAgency", "@id": `${site}/#org`, name: "Travel Devils" },
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [["Home", site], ["Blog", `${site}/blog`], [post.title, url]].map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
    },
  ];
  const wa = `https://wa.me/?text=${encodeURIComponent(`${post.title} ${url}`)}`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="mx-auto max-w-3xl px-4 pt-10 sm:pt-14">
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-1.5 text-sm font-semibold text-muted">
          <Link href="/blog" className="hover:text-ink">Blog</Link>
          {post.category && <><span aria-hidden>/</span><Link href={`/blog?category=${encodeURIComponent(post.category)}`} className="hover:text-ink">{post.category}</Link></>}
        </nav>
        <h1 className="display mt-4 text-4xl sm:text-6xl">{post.title}</h1>
        {post.excerpt && <p className="mt-5 text-xl leading-relaxed text-muted">{post.excerpt}</p>}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-y border-line py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-brand text-sm font-extrabold text-white" aria-hidden>
              {by.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </span>
            <div>
              <p className="text-sm font-extrabold">{by}</p>
              <BlogMeta post={post} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={wa} target="_blank" rel="noopener" className="press inline-flex items-center gap-1.5 rounded-full bg-green-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-green-800">
              <MessageCircle className="size-4" aria-hidden />Share
            </a>
            <ShareButton title={post.title} />
          </div>
        </div>
      </header>

      {post.coverImage && (
        <div className="relative mx-auto mt-10 aspect-[16/9] max-w-6xl overflow-hidden bg-surface sm:rounded-[2rem] lg:mx-auto">
          <Image src={post.coverImage} alt="" fill loading="eager" fetchPriority="high" sizes="(max-width: 1152px) 100vw, 1152px" className="object-cover" />
        </div>
      )}

      <div className={`mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:py-16 ${toc.length > 1 ? "lg:grid-cols-[1fr_17rem]" : ""}`}>
        <article className={`min-w-0 ${toc.length > 1 ? "" : "mx-auto max-w-3xl"}`}>
          <div className="prose-admin prose-blog text-[18px]" dangerouslySetInnerHTML={{ __html: head.html }} />
          {faq && (
            <>
              <h2 id="faqs" className="headline mb-5 mt-10 scroll-mt-[calc(7rem+var(--topbar-h,0px))] text-[1.75rem]">{faq.title}</h2>
              <FaqList items={faq.faqs} />
              {tail && <div className="prose-admin prose-blog text-[18px]" dangerouslySetInnerHTML={{ __html: tail.html }} />}
            </>
          )}
        </article>
        {toc.length > 1 && (
          <aside className="max-lg:hidden">
            <div className="sticky top-32 space-y-4">
              <nav aria-label="In this story" className="rounded-3xl bg-surface p-5">
                <p className="eyebrow mb-3 text-muted">In this story</p>
                <ol className="space-y-2 text-sm font-bold">
                  {toc.map((h) => <li key={h.id}><a href={`#${h.id}`} className="block text-ink/70 hover:text-brand-dark">{h.text}</a></li>)}
                </ol>
              </nav>
              <div className="rounded-3xl bg-ink p-5 text-white">
                <p className="font-extrabold">Want to go?</p>
                <p className="mt-1 text-sm text-white/70">We run group departures every week.</p>
                <Link href="/upcoming-trips" className="press mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-extrabold hover:bg-brand-dark">See trips<ArrowRight className="size-4" aria-hidden /></Link>
              </div>
            </div>
          </aside>
        )}
      </div>

      {related.length > 0 && (
        <section className="bg-surface py-14 sm:py-16">
          <div className="mx-auto max-w-6xl px-4">
            <p className="eyebrow text-brand">Make it happen</p>
            <h2 className="headline mt-2 text-3xl">Trips from this story</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{related.map((tr) => <TripCard key={tr.id} trip={tr} />)}</div>
          </div>
        </section>
      )}

      {more.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <h2 className="headline text-3xl">Keep reading</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{more.map((p) => <BlogCard key={p.id} post={p} />)}</div>
        </section>
      )}
      <CtaBand title="Ready for your own story?" />
    </>
  );
}
