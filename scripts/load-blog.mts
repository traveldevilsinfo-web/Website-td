// Publishes reviewed blog posts from content/blog/*.md (JSON front matter between --- lines, Markdown body).
//   npm run blog:load              → local DB (DATABASE_URL from .env.local)
//   DATABASE_URL=… npm run blog:load → any other DB (e.g. Supabase)
// Upserts by slug; keeps the original published date on re-runs. Refuses to write if any post fails the checks.
import { readdir, readFile } from "node:fs/promises";
import postgres from "postgres";

type Front = { title: string; excerpt: string; seoTitle: string; category: string; tags: string[]; cover: string };

const dir = "content/blog";
const posts = await Promise.all((await readdir(dir)).filter((f) => f.endsWith(".md")).map(async (f) => {
  const raw = await readFile(`${dir}/${f}`, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${f}: missing front matter`);
  return { slug: f.slice(0, -3), front: JSON.parse(m[1]) as Front, body: m[2].trim() };
}));

const problems: string[] = [];
const banned = /tripping\s?cube|wanderon|justwravel|go4explore|thrillophilia|\[\[CONFIRM|lorem/i;
for (const { slug, front: f, body } of posts) {
  if (!f.title || f.title.length > 75) problems.push(`${slug}: title length ${f.title?.length}`);
  if (!f.excerpt || f.excerpt.length > 200) problems.push(`${slug}: excerpt length ${f.excerpt?.length}`);
  if (!f.cover?.startsWith("/uploads/")) problems.push(`${slug}: cover must be an uploaded image`);
  if (banned.test(body + f.title + f.excerpt)) problems.push(`${slug}: banned text "${(body + f.title + f.excerpt).match(banned)![0]}"`);
  if (/^# /m.test(body)) problems.push(`${slug}: body has an H1`);
  for (const [, to] of body.matchAll(/\]\(\/blog\/([a-z0-9-]+)\)/g)) if (!posts.some((p) => p.slug === to)) problems.push(`${slug}: links to missing post ${to}`);
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const [admin] = await sql<{ id: number }[]>`select id from users where role = 'admin' order by id limit 1`;
for (const { slug, front: f, body } of posts) {
  const seo = { title: f.seoTitle, description: f.excerpt };
  await sql`
    insert into posts (title, slug, status, excerpt, content, cover_image, category, tags, author_id, published_at, seo)
    values (${f.title}, ${slug}, 'published', ${f.excerpt}, ${body}, ${f.cover}, ${f.category}, ${f.tags}, ${admin?.id ?? null}, now(), ${sql.json(seo)})
    on conflict (slug) do update set title = excluded.title, excerpt = excluded.excerpt, content = excluded.content,
      cover_image = excluded.cover_image, category = excluded.category, tags = excluded.tags, seo = excluded.seo,
      status = 'published', published_at = coalesce(posts.published_at, excluded.published_at), updated_at = now()`;
  console.log(`published ${slug}`);
}
await sql.end();
