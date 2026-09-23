import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { md } from "@/lib/markdown";
import { getPost, getPosts } from "@/lib/queries";
import { CtaBand } from "@/components/site/ui";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const p = await getPost((await params).slug);
  if (!p) return {};
  return { title: p.seo.title || p.title, description: p.seo.description || p.excerpt || undefined, openGraph: { images: [p.seo.ogImage || p.coverImage || ""].filter(Boolean), type: "article" } };
}

export default async function BlogPost({ params }: PageProps<"/blog/[slug]">) {
  const post = await getPost((await params).slug);
  if (!post) notFound();
  const more = (await getPosts(4)).filter((p) => p.id !== post.id).slice(0, 3);
  const minutes = Math.max(1, Math.round(post.content.split(/\s+/).length / 220));
  return (
    <>
      <article className="mx-auto max-w-3xl px-4 pt-12">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm font-semibold text-muted"><Link href="/blog" className="hover:text-ink">← All stories</Link></nav>
        {post.category && <p className="eyebrow text-brand">{post.category}</p>}
        <h1 className="display mt-3 text-4xl sm:text-6xl">{post.title}</h1>
        <p className="mt-5 text-sm font-bold text-muted">
          {post.publishedAt?.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · {minutes} min read
        </p>
      </article>
      {post.coverImage && (
        <div className="relative mx-auto mt-10 aspect-[16/9] max-w-5xl overflow-hidden rounded-[2rem] bg-surface sm:mx-4 lg:mx-auto">
          <Image src={post.coverImage} alt="" fill priority sizes="(max-width: 1024px) 100vw, 1024px" className="object-cover" />
        </div>
      )}
      <div className="prose-admin mx-auto max-w-3xl px-4 py-12 text-[18px]" dangerouslySetInnerHTML={{ __html: md(post.content) }} />
      {more.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pb-8">
          <h2 className="headline mb-6 text-2xl">Keep reading</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {more.map((p) => (
              <Link key={p.id} href={`/blog/${p.slug}`} className="card rounded-3xl bg-surface p-6"><h3 className="headline text-lg">{p.title}</h3></Link>
            ))}
          </div>
        </section>
      )}
      <CtaBand />
    </>
  );
}
