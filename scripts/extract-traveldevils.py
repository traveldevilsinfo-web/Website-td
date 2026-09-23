#!/usr/bin/env python3
"""Snapshot everything public on traveldevils.in (WordPress + WP Travel Engine) into content/traveldevils/.

Re-runnable; skips media already downloaded.  Run: python3 scripts/extract-traveldevils.py
Output:
  site.json            name, logo/icon, contacts, socials, menus (parsed from homepage)
  taxonomies.json      every term (destinations, trip types, durations, ...)
  trips/<slug>.json    full trip: overview, itinerary, pricing packages, dates, includes/excludes, FAQs, images
  trips/<slug>.md      human-readable version
  pages/, posts/       JSON + Markdown per page/post
  html/<path>.html     raw rendered HTML of every sitemap URL
  media/<yyyy/mm/file> all uploaded images/videos/logos
"""
import html, json, os, re, sys, time, urllib.request
from html.parser import HTMLParser
from urllib.parse import urlparse

SITE = "https://traveldevils.in"
API = SITE + "/wp-json"
OUT = os.path.join(os.path.dirname(__file__), "..", "content", "traveldevils")
UA = {"User-Agent": "Mozilla/5.0 (TravelDevils content export)"}


def get(url, raw=False, tries=5):
    for i in range(tries):
        time.sleep(0.7)  # be polite: host rate-limits (429) bursts
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                b = r.read()
                return b if raw else json.loads(b)
        except Exception as e:
            if i == tries - 1 or getattr(e, "code", None) == 404:
                print("  FAIL", url, e, file=sys.stderr)
                return None
            time.sleep(30 * (i + 1) if getattr(e, "code", None) == 429 else 3 * (i + 1))


def get_all(path):
    items, page = [], 1
    while True:
        d = get(f"{API}/{path}{'&' if '?' in path else '?'}per_page=100&page={page}")
        if not d or not isinstance(d, list):
            break
        items += d
        if len(d) < 100:
            break
        page += 1
    return items


def save(rel, data):
    p = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    mode = "wb" if isinstance(data, bytes) else "w"
    with open(p, mode, **({} if mode == "wb" else {"encoding": "utf-8"})) as f:
        f.write(data if isinstance(data, (str, bytes)) else json.dumps(data, indent=2, ensure_ascii=False))


class MD(HTMLParser):
    """Tiny HTML -> Markdown: headings, paragraphs, lists, links, images. Skips script/style/nav chrome."""

    SKIP = {"script", "style", "noscript", "svg", "form", "iframe"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.skip, self.href = [], 0, None

    def handle_starttag(self, t, a):
        a = dict(a)
        if t in self.SKIP:
            self.skip += 1
        elif self.skip:
            return
        elif re.fullmatch(r"h[1-6]", t):
            self.out.append("\n\n" + "#" * int(t[1]) + " ")
        elif t in ("p", "div", "section", "tr", "br"):
            self.out.append("\n")
        elif t == "li":
            self.out.append("\n- ")
        elif t == "a":
            self.href = a.get("href")
            self.out.append("[")
        elif t == "img":
            src = a.get("data-src") or a.get("src") or ""
            if src and not src.startswith("data:"):
                self.out.append(f"\n![{a.get('alt') or ''}]({src})\n")

    def handle_endtag(self, t):
        if t in self.SKIP:
            self.skip = max(0, self.skip - 1)
        elif self.skip:
            return
        elif t == "a":
            self.out.append(f"]({self.href})" if self.href else "]")
            self.href = None
        elif re.fullmatch(r"h[1-6]|p", t):
            self.out.append("\n")

    def handle_data(self, d):
        if not self.skip:
            self.out.append(re.sub(r"\s+", " ", d))

    def text(self):
        s = "".join(self.out).replace("[]()", "").replace("[ ]", "")
        s = re.sub(r"\[\s*\]\([^)]*\)", "", s)
        s = re.sub(r"[ \t]+\n", "\n", s)
        return re.sub(r"\n{3,}", "\n\n", s).strip() + "\n"


def to_md(h):
    p = MD()
    p.feed(h or "")
    return p.text()


def summarize_dates(dates):
    """WTE returns every bookable day with full pricing (~1MB). Keep only the date span per package."""
    out = []
    for d in dates or []:
        days = sorted((d.get("dates") or {}).keys())
        out.append({"package": (d.get("package") or {}).get("name"), "count": len(days),
                    "first": days[0] if days else None, "last": days[-1] if days else None,
                    "dates": days if len(days) <= 60 else None})  # list only real fixed departures
    return out


def main_content(page_html):
    """Strip header/footer chrome so page Markdown is just the body."""
    s = page_html.decode("utf-8", "ignore") if isinstance(page_html, bytes) else page_html
    s = re.sub(r"<header\b.*?</header>", "", s, flags=re.S | re.I)
    s = re.sub(r"<footer\b.*?</footer>", "", s, flags=re.S | re.I)
    s = re.sub(r'<div[^>]+data-elementor-type="(header|footer)".*?(?=<div[^>]+data-elementor-type="(?!header|footer))', "", s, flags=re.S)
    m = re.search(r"<body\b.*", s, flags=re.S)
    return m.group(0) if m else s


# ---------------------------------------------------------------- run

def run():
    os.makedirs(OUT, exist_ok=True)
    root = get(API)
    uploads = set()

    # Taxonomies
    tax_bases = {
        "destination": "destination", "trip_types": "trip_types", "trip_duration": "trip_duration",
        "difficulty": "difficulty", "activities": "activities", "trip_tag": "trip_tag",
        "upcomingtrips": "wptravelengine_custom_taxonomy_upcomingtrips", "new_upcoming_trips": "new_upcoming_trips",
        "package_categories": "package-categories", "categories": "categories", "tags": "tags",
    }
    tax = {}
    for name, base in tax_bases.items():
        tax[name] = [{k: t.get(k) for k in ("id", "name", "slug", "parent", "count", "description", "link")}
                     for t in get_all("wp/v2/" + base)]
    save("taxonomies.json", tax)
    term = {name: {t["id"]: t["name"] for t in terms} for name, terms in tax.items()}
    print("taxonomies:", {k: len(v) for k, v in tax.items()})

    # Media index
    media = get_all("wp/v2/media")
    media_by_id = {m["id"]: m for m in media}
    save("media.json", [{k: m.get(k) for k in ("id", "slug", "title", "alt_text", "caption", "mime_type", "source_url", "media_details")}
                        | {"title": m["title"]["rendered"], "caption": to_md(m["caption"]["rendered"]).strip()} for m in media])
    uploads |= {m["source_url"] for m in media}
    print("media items:", len(media))

    # Trips
    trips = get_all("wp/v2/trip")
    index = []
    for t in trips:
        tid, slug = t["id"], t["slug"]
        v2 = get(f"{API}/wptravelengine/v2/trips/{tid}") or {}
        packages = get(f"{API}/wptravelengine/v2/trips/{tid}/packages") or []
        dates = get(f"{API}/wptravelengine/v2/trips/{tid}/dates") or []
        page_html = get(t["link"], raw=True) or b""
        imgs = sorted(set(re.findall(rb'https://traveldevils\.in/wp-content/uploads/[^"\'\s)]+?\.(?:jpe?g|png|webp|avif|gif|svg|mp4)', page_html)))
        imgs = [i.decode() for i in imgs]
        uploads |= set(imgs)
        fm = media_by_id.get(t.get("featured_media"))
        trip = {
            "id": tid, "slug": slug, "url": t["link"], "title": html.unescape(t["title"]["rendered"]),
            "code": t.get("code"), "modified": t.get("modified"),
            "duration": t.get("duration"),
            "price": t.get("price"), "sale_price": t.get("sale_price"), "has_sale": t.get("has_sale"),
            "currency": (t.get("currency") or {}).get("code"),
            "min_pax": t.get("min_pax"), "max_pax": t.get("max_pax"),
            "featured_image": fm and fm["source_url"],
            "destinations": [term["destination"].get(i, i) for i in t.get("destination", [])],
            "trip_types": [term["trip_types"].get(i, i) for i in t.get("trip_types", [])],
            "trip_duration": [term["trip_duration"].get(i, i) for i in t.get("trip_duration", [])],
            "difficulty": [term["difficulty"].get(i, i) for i in t.get("difficulty", [])],
            "activities": [term["activities"].get(i, i) for i in t.get("activities", [])],
            "upcoming": [term["upcomingtrips"].get(i, i) for i in t.get("wptravelengine_custom_taxonomy_upcomingtrips", [])],
            "overview_html": v2.get("overview") or t.get("description"),
            "overview": to_md(v2.get("overview") or t.get("description")),
            "highlights": v2.get("highlights"),
            "itinerary": [{"day": i + 1, "title": d.get("title"), "content": to_md(d.get("content"))}
                          for i, d in enumerate(t.get("itineraries") or [])],
            "includes": [x.strip() for x in (t.get("cost_includes") or "").split("\n") if x.strip()],
            "excludes": [x.strip() for x in (t.get("cost_excludes") or "").split("\n") if x.strip()],
            "faqs": [{"q": f.get("question") or f.get("title"), "a": to_md(f.get("answer") or f.get("content"))} for f in (t.get("faqs") or [])],
            "packages": [{"name": p.get("name"), "is_primary": p.get("is_primary"),
                          "pricing": [{"label": c.get("label"), "price": c.get("price"), "sale_price": c.get("sale_price"),
                                       "type": (c.get("pricing_type") or {}).get("value")}
                                      for c in p.get("traveler_categories", [])]} for p in packages],
            "dates": summarize_dates(dates),
            "trip_extras": t.get("trip_extras"),
            "images": imgs,
            "page_markdown": to_md(main_content(page_html)),
            "raw": {"wp": t, "wte_v2": v2},
        }
        save(f"trips/{slug}.json", trip)
        md = [f"# {trip['title']}\n", f"URL: {trip['url']}  ", f"Price: ₹{trip['price']}  ",
              f"Duration: {trip['duration']}  ", f"Destinations: {', '.join(map(str, trip['destinations']))}\n",
              "## Pricing"] + [f"- **{p['name']}**: " + "; ".join(f"{c['label']} ₹{c['price'] or '—'}" for c in p["pricing"]) for p in trip["packages"]]
        md += ["\n## Overview\n", trip["overview"], "## Itinerary"]
        md += [f"\n### Day {d['day']}: {d['title']}\n\n{d['content']}" for d in trip["itinerary"]]
        md += ["\n## Includes"] + [f"- {x}" for x in trip["includes"]] + ["\n## Excludes"] + [f"- {x}" for x in trip["excludes"]]
        if trip["faqs"]:
            md += ["\n## FAQs"] + [f"\n**{f['q']}**\n\n{f['a']}" for f in trip["faqs"]]
        md += ["\n## Images"] + [f"- {i}" for i in imgs]
        save(f"trips/{slug}.md", "\n".join(md) + "\n")
        index.append({k: trip[k] for k in ("slug", "title", "price", "duration", "destinations", "trip_types", "featured_image", "url")})
        print("trip:", slug)
    save("trips.json", index)

    # Pages + posts (full rendered page, so Elementor widgets are included)
    for kind in ("pages", "posts"):
        for p in get_all(f"wp/v2/{kind}"):
            page_html = get(p["link"], raw=True) or b""
            uploads |= {u.decode() for u in re.findall(rb'https://traveldevils\.in/wp-content/uploads/[^"\'\s)]+?\.(?:jpe?g|png|webp|avif|gif|svg|mp4)', page_html)}
            fm = media_by_id.get(p.get("featured_media"))
            rec = {"id": p["id"], "slug": p["slug"], "url": p["link"], "title": html.unescape(p["title"]["rendered"]),
                   "date": p.get("date"), "modified": p.get("modified"), "parent": p.get("parent"),
                   "featured_image": fm and fm["source_url"],
                   "markdown": to_md(main_content(page_html)), "wp_content_html": p["content"]["rendered"]}
            save(f"{kind}/{p['slug']}.json", rec)
            save(f"{kind}/{p['slug']}.md", f"# {rec['title']}\n\nURL: {rec['url']}\n\n{rec['markdown']}")
            print(kind[:-1] + ":", p["slug"])

    # Raw HTML snapshot of every sitemap URL + site chrome from homepage
    idx = get(SITE + "/wp-sitemap.xml", raw=True) or b""
    urls = []
    for sm in re.findall(rb"<loc>([^<]+)</loc>", idx):
        if b"users" in sm:
            continue  # skip author listings
        urls += [u.decode() for u in re.findall(rb"<loc>([^<]+)</loc>", get(sm.decode(), raw=True) or b"")]
    save("urls.txt", "\n".join(urls) + "\n")
    for u in urls:
        path = urlparse(u).path.strip("/") or "index"
        if not os.path.exists(os.path.join(OUT, "html", path + ".html")):
            b = get(u, raw=True)
            if b:
                save(f"html/{path}.html", b)
                uploads |= {x.decode() for x in re.findall(rb'https://traveldevils\.in/wp-content/uploads/[^"\'\s)]+?\.(?:jpe?g|png|webp|avif|gif|svg|mp4)', b)}
    print("html snapshots:", len(urls))

    home = (open(os.path.join(OUT, "html", "index.html"), "rb").read().decode("utf-8", "ignore")
            if os.path.exists(os.path.join(OUT, "html", "index.html")) else "")
    logo = media_by_id.get(root.get("site_logo")) if root else None
    site = {
        "name": root and root.get("name"), "tagline": root and root.get("description"), "url": SITE,
        "logo": logo and logo["source_url"], "icon": root and root.get("site_icon_url"),
        "logo_candidates": sorted(set(re.findall(r'https://traveldevils\.in/wp-content/uploads/[^"\'\s]*(?:logo|Logo|LOGO|Frame)[^"\'\s]*', home))),
        "phones": sorted(set(re.findall(r'tel:([+\d][\d\s-]{8,})', home))),
        "emails": sorted(set(re.findall(r'mailto:([^"\'?\s]+)', home))),
        "whatsapp": sorted(set(re.findall(r'(?:wa\.me|api\.whatsapp\.com/send\?phone=)/?(\d{10,15})', home))),
        "socials": sorted(set(re.findall(r'https?://(?:www\.)?(?:instagram|facebook|youtube|linkedin|twitter|x|pinterest)\.com/[^"\'\s<]+', home))),
        "nav_links": sorted(set(re.findall(r'href="(https://traveldevils\.in/[^"#?]*)"', home))),
    }
    save("site.json", site)
    if site["logo"]:
        uploads.add(site["logo"])
    if site["icon"]:
        uploads.add(site["icon"])

    # Download media (originals only; skip WP-generated -WxH thumbnails when the original is also referenced)
    originals = {re.sub(r"-\d+x\d+(?=\.\w+$)", "", u) for u in uploads}
    files = sorted(originals | {u for u in uploads if re.sub(r"-\d+x\d+(?=\.\w+$)", "", u) not in originals})
    save("media_urls.txt", "\n".join(files) + "\n")
    n = 0
    for u in files:
        rel = "media/" + u.split("/wp-content/uploads/")[1]
        if os.path.exists(os.path.join(OUT, rel)):
            continue
        b = get(u, raw=True)
        if b:
            save(rel, b)
            n += 1
    print(f"media downloaded: {n} new, {len(files)} total referenced")


if __name__ == "__main__":
    run()
