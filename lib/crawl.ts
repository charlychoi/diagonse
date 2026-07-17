/** Lightweight HTML crawl for marketing diagnosis (MVP, no Playwright) */

export type CrawledPage = {
  url: string;
  status: number;
  html: string;
  finalUrl: string;
};

export type ParsedSiteSignals = {
  url: string;
  hostname: string;
  title: string | null;
  description: string | null;
  h1s: string[];
  h2s: string[];
  canonical: string | null;
  lang: string | null;
  hasViewport: boolean;
  hasOg: boolean;
  hasTwitterCard: boolean;
  hasJsonLd: boolean;
  hasSchemaOrg: boolean;
  hasRobotsMeta: boolean;
  /** content of meta name=robots if present */
  robotsMetaContent: string | null;
  hasSitemapHint: boolean;
  hasFavicon: boolean;
  https: boolean;
  wordCount: number;
  imageCount: number;
  imagesWithAlt: number;
  internalLinks: number;
  externalLinks: number;
  socialLinks: string[];
  hasForm: boolean;
  hasCtaHints: boolean;
  hasContact: boolean;
  hasBlog: boolean;
  hasAbout: boolean;
  hasPrivacy: boolean;
  hasAnalyticsHints: boolean;
  hasNav: boolean;
  hasFooter: boolean;
  pageCountCrawled: number;
  pages: string[];
  rawSnippets: {
    title: string | null;
    description: string | null;
    firstH1: string | null;
  };
};

const SOCIAL_HOSTS = [
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "youtube.com",
  "tiktok.com",
  "threads.net",
  "blog.naver.com",
  "pf.kakao.com",
];

const CTA_PATTERN =
  /신청|문의|상담|무료|시작|구독|가입|구매|demo|trial|contact|get started|sign up|book|quote|상담하기|무료체험/i;

function extractMetaContent(html: string, nameOrProp: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${nameOrProp}["'][^>]+content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${nameOrProp}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtml(m[1].trim());
  }
  return null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTags(html: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = stripTags(m[1]).trim();
    if (text) out.push(text);
  }
  return out;
}

function normalizeUrl(input: string): string {
  let url = input.trim();
  // Bare hostnames get https://. Existing schemes are preserved then validated.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
    url = `https://${url}`;
  }
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http/https URLs are supported");
  }
  return parsed.toString();
}

async function fetchPage(
  url: string,
  timeoutMs = 12000,
): Promise<CrawledPage | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "MarkDiagBot/1.0 (+https://markdiag.local; marketing-diagnosis)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      // still try if status ok and body looks like html
    }
    const html = await res.text();
    return {
      url,
      status: res.status,
      html: html.slice(0, 500_000),
      finalUrl: res.url || url,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function discoverPaths(base: URL, html: string): string[] {
  const candidates = new Set<string>();
  const defaults = ["/about", "/about-us", "/blog", "/contact", "/company"];
  for (const path of defaults) {
    candidates.add(new URL(path, base.origin).toString());
  }

  const hrefRe = /href=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    try {
      const abs = new URL(m[1], base.origin);
      if (abs.origin !== base.origin) continue;
      const path = abs.pathname.toLowerCase();
      if (
        /about|company|blog|news|contact|privacy|service|product|pricing/.test(
          path,
        )
      ) {
        candidates.add(abs.origin + abs.pathname);
      }
    } catch {
      /* ignore bad hrefs */
    }
  }
  return [...candidates].slice(0, 4);
}

export async function crawlAndParse(rawUrl: string): Promise<ParsedSiteSignals> {
  const url = normalizeUrl(rawUrl);
  const base = new URL(url);
  const home = await fetchPage(url);

  if (!home || home.status >= 400 || !home.html) {
    // Offline / blocked fallback: minimal signals so diagnosis still returns
    return {
      url,
      hostname: base.hostname,
      title: null,
      description: null,
      h1s: [],
      h2s: [],
      canonical: null,
      lang: null,
      hasViewport: false,
      hasOg: false,
      hasTwitterCard: false,
      hasJsonLd: false,
      hasSchemaOrg: false,
      hasRobotsMeta: false,
      robotsMetaContent: null,
      hasSitemapHint: false,
      hasFavicon: false,
      https: base.protocol === "https:",
      wordCount: 0,
      imageCount: 0,
      imagesWithAlt: 0,
      internalLinks: 0,
      externalLinks: 0,
      socialLinks: [],
      hasForm: false,
      hasCtaHints: false,
      hasContact: false,
      hasBlog: false,
      hasAbout: false,
      hasPrivacy: false,
      hasAnalyticsHints: false,
      hasNav: false,
      hasFooter: false,
      pageCountCrawled: 0,
      pages: [],
      rawSnippets: { title: null, description: null, firstH1: null },
    };
  }

  const pages: CrawledPage[] = [home];
  const extraUrls = discoverPaths(new URL(home.finalUrl), home.html);
  const extras = await Promise.all(
    extraUrls
      .filter((u) => u !== home.finalUrl && u !== url)
      .slice(0, 2)
      .map((u) => fetchPage(u, 8000)),
  );
  for (const p of extras) {
    if (p && p.status < 400 && p.html) pages.push(p);
  }

  const combined = pages.map((p) => p.html).join("\n");
  const titleMatch = home.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeHtml(stripTags(titleMatch[1])).trim() : null;
  const description =
    extractMetaContent(home.html, "description") ||
    extractMetaContent(home.html, "og:description");
  const h1s = extractTags(home.html, "h1").slice(0, 8);
  const h2s = extractTags(combined, "h2").slice(0, 20);
  const canonicalMatch = home.html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
  );
  const langMatch = home.html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  const text = stripTags(combined);
  const words = text.split(/\s+/).filter(Boolean);

  const imgTags = combined.match(/<img\b[^>]*>/gi) ?? [];
  const imagesWithAlt = imgTags.filter((tag) =>
    /\balt=["'][^"']+["']/i.test(tag),
  ).length;

  const hrefs = [...combined.matchAll(/href=["']([^"'#]+)["']/gi)].map(
    (x) => x[1],
  );
  let internalLinks = 0;
  let externalLinks = 0;
  const socialLinks = new Set<string>();
  for (const href of hrefs) {
    try {
      const abs = new URL(href, base.origin);
      if (abs.origin === base.origin) internalLinks += 1;
      else {
        externalLinks += 1;
        if (SOCIAL_HOSTS.some((h) => abs.hostname.includes(h))) {
          socialLinks.add(abs.hostname.replace(/^www\./, ""));
        }
      }
    } catch {
      /* skip */
    }
  }

  return {
    url: home.finalUrl || url,
    hostname: base.hostname,
    title,
    description,
    h1s,
    h2s,
    canonical: canonicalMatch?.[1] ?? null,
    lang: langMatch?.[1] ?? null,
    hasViewport: /name=["']viewport["']/i.test(home.html),
    hasOg: /property=["']og:/i.test(home.html),
    hasTwitterCard: /name=["']twitter:card["']/i.test(home.html),
    hasJsonLd: /application\/ld\+json/i.test(combined),
    hasSchemaOrg: /schema\.org/i.test(combined),
    hasRobotsMeta: /name=["']robots["']/i.test(home.html),
    robotsMetaContent: extractMetaContent(home.html, "robots"),
    hasSitemapHint: /sitemap/i.test(combined),
    hasFavicon: /rel=["'][^"']*icon[^"']*["']/i.test(home.html),
    https: (home.finalUrl || url).startsWith("https:"),
    wordCount: words.length,
    imageCount: imgTags.length,
    imagesWithAlt,
    internalLinks,
    externalLinks,
    socialLinks: [...socialLinks],
    hasForm: /<form\b/i.test(combined),
    hasCtaHints: CTA_PATTERN.test(combined),
    hasContact: /contact|문의|연락|상담/i.test(combined),
    hasBlog: /blog|news|인사이트|아티클|매거진/i.test(combined),
    hasAbout: /about|소개|회사소개|our story/i.test(combined),
    hasPrivacy: /privacy|개인정보/i.test(combined),
    hasAnalyticsHints:
      /gtag|googletagmanager|ga\(|gtm\.js|analytics|hotjar|mixpanel|amplitude/i.test(
        combined,
      ),
    hasNav: /<nav\b/i.test(combined) || /role=["']navigation["']/i.test(combined),
    hasFooter: /<footer\b/i.test(combined),
    pageCountCrawled: pages.length,
    pages: pages.map((p) => p.finalUrl || p.url),
    rawSnippets: {
      title,
      description,
      firstH1: h1s[0] ?? null,
    },
  };
}

export { normalizeUrl };
