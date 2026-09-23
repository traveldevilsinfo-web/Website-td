import Image from "next/image";
import Link from "next/link";
import { readMinutes } from "@/lib/blog";

type Post = { id: number; slug: string; title: string; excerpt: string | null; coverImage: string | null; category: string | null; content: string; publishedAt: Date | null };

const date = (d: Date | null) => d?.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function BlogMeta({ post, className = "" }: { post: Post; className?: string }) {
  return (
    <p className={`text-xs font-bold text-muted ${className}`}>
      {date(post.publishedAt)}{post.publishedAt && " · "}{readMinutes(post.content)} min read
    </p>
  );
}

/** Magazine card. `lead` = the big featured layout at the top of /blog. */
export function BlogCard({ post, lead, priority }: { post: Post; lead?: boolean; priority?: boolean }) {
  return (
    <Link href={`/blog/${post.slug}`}
      className={`card group grid overflow-hidden rounded-[2rem] bg-white ring-1 ring-line ${lead ? "md:grid-cols-[1.2fr_1fr]" : ""}`}>
      <div className={`relative overflow-hidden bg-surface ${lead ? "aspect-[16/10] md:aspect-auto md:min-h-[26rem]" : "aspect-[16/10]"}`}>
        {post.coverImage && (
          <Image src={post.coverImage} alt="" fill loading={priority ? "eager" : undefined} fetchPriority={priority ? "high" : undefined}
            sizes={lead ? "(max-width: 768px) 100vw, 60vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
            className="object-cover transition-transform duration-700 group-hover:scale-105" />
        )}
        {post.category && (
          <span className="glass absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-extrabold text-ink">{post.category}</span>
        )}
      </div>
      <div className={`flex flex-col ${lead ? "justify-center p-8 md:p-12" : "p-6"}`}>
        {lead && <p className="eyebrow text-brand">Latest story</p>}
        <h3 className={`headline ${lead ? "mt-3 text-3xl md:text-4xl" : "text-xl leading-snug"} group-hover:text-brand-dark`}>{post.title}</h3>
        {post.excerpt && <p className={`mt-3 text-muted ${lead ? "text-lg" : "line-clamp-2"}`}>{post.excerpt}</p>}
        <BlogMeta post={post} className={lead ? "mt-6 text-sm" : "mt-4"} />
      </div>
    </Link>
  );
}
