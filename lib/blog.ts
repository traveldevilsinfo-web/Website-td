// Pure helpers for blog pages (no I/O).

export const readMinutes = (markdown: string) => Math.max(1, Math.round(markdown.split(/\s+/).filter(Boolean).length / 220));

const slug = (s: string) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";

/** Adds ids to <h2> headings (for anchor links) and returns them as a table of contents. */
export function withHeadingIds(html: string) {
  const toc: { id: string; text: string }[] = [];
  const seen = new Map<string, number>();
  const out = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, inner: string) => {
    const base = slug(inner);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    const id = n ? `${base}-${n + 1}` : base;
    toc.push({ id, text: inner.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim() });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html: out, toc };
}

/** Trips a post is about: the trip or its destination is named in the post's title, tags or category. */
export function tripsForPost<T extends { title: string; destinationName: string | null }>(
  post: { title: string; tags: string[]; category: string | null; content: string }, trips: T[], limit = 3,
) {
  const hay = [post.title, post.category ?? "", ...post.tags].join(" ").toLowerCase();
  const body = post.content.toLowerCase();
  const score = (t: T) => {
    const names = [t.title, t.destinationName].filter(Boolean).map((x) => x!.toLowerCase());
    return names.some((n) => hay.includes(n)) ? 2 : names.some((n) => n.length > 3 && body.includes(n)) ? 1 : 0;
  };
  return trips.map((t) => ({ t, s: score(t) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.t);
}

/** Splits a post's "## FAQs" section into "**Question?**\nAnswer" pairs (rendered as an accordion) and the markdown around it. */
export function splitFaqs(markdown: string) {
  const h = markdown.match(/^## (FAQs?|Frequently asked questions)\s*$/im);
  if (!h) return null;
  const start = h.index! + h[0].length;
  const next = markdown.slice(start).search(/^## /m);
  const end = next < 0 ? markdown.length : start + next;
  const faqs: { q: string; a: string }[] = [];
  const rest: string[] = [];
  for (const block of markdown.slice(start, end).split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)) {
    const m = block.match(/^\*\*(.+?\?)\*\*\s*([\s\S]+)$/);
    if (m) faqs.push({ q: m[1].trim(), a: m[2].trim() });
    else rest.push(block); // intro/outro paragraphs stay as normal text after the list
  }
  if (!faqs.length) return null;
  return { title: h[1], before: markdown.slice(0, h.index), faqs, after: [...rest, markdown.slice(end)].join("\n\n") };
}
