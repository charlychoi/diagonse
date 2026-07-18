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
  /** stripped body text (first ~10k chars) for keyword mining / AI analysis */
  bodyText: string;
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
  hero?: {
    headline: string | null;
    subcopy: string | null;
    ctas: string[];
    trustSignals: string[];
  };
  conversion?: {
    ctaTexts: string[];
    telLinks: string[];
    mailtoLinks: string[];
    kakaoLinks: string[];
    naverTalkLinks: string[];
    bookingLinks: string[];
    contactPageUrls: string[];
    formCount: number;
  };
  servicePages?: {
    url: string;
    title: string | null;
    h1: string | null;
    bodyText: string;
    ctaTexts: string[];
    hasForm: boolean;
    hasContact: boolean;
  }[];
  /** JSON-LD @type values detected (Organization, LocalBusiness, FAQPage, ...) */
  schemaTypes: string[];
  /** phone numbers detected (tel: links or Korean phone patterns) */
  phones: string[];
  /** address hints detected (도로명/지번 patterns) */
  addressHints: string[];
  /** review / rating signal present (aggregateRating, 리뷰/평점/후기) */
  hasReviewSignal: boolean;
  /** embedded map (Google/Naver/Kakao) detected */
  hasMapEmbed: boolean;
  /** business hours / 영업시간 signal */
  hasHours: boolean;
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
  /신청|문의|상담|무료|시작|구독|가입|구매|예약|데모|demo|trial|contact|get started|sign up|book|quote|상담하기|무료체험/i;

const SERVICE_PATH_PATTERN =
  /service|product|program|course|education|consulting|solution|pricing|apply|reservation|서비스|상품|프로그램|교육|컨설팅|솔루션|신청|예약/i;

function extractActionTexts(html: string): string[] {
  const out = new Set<string>();
  for (const match of html.matchAll(/<(?:a|button)\b[^>]*>([\s\S]*?)<\/(?:a|button)>/gi)) {
    const text = stripTags(match[1]).trim().replace(/\s+/g, " ");
    if (text && text.length <= 50 && CTA_PATTERN.test(text)) out.add(text);
  }
  return [...out].slice(0, 12);
}

function pageTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtml(stripTags(match[1])).trim() || null : null;
}

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
  return (
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      // page-builder artifacts that pollute keyword mining (SVG paths, inline
      // templates, embedded JSON config leak CSS/HTML tokens like hover/nav)
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<template[\s\S]*?<\/template>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      // collapse leftover CSS rule bodies ({ ... }) and prop:value; fragments
      .replace(/\{[^{}]*\}/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
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
  const defaults = [
    "/about", "/contact", "/service", "/services", "/product", "/program",
    "/education", "/consulting", "/solution", "/pricing", "/apply", "/reservation",
  ];
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
        /about|company|blog|news|contact|privacy|service|product|program|course|education|consulting|solution|pricing|apply|reservation|서비스|상품|프로그램|교육|컨설팅|솔루션|신청|예약/.test(
          path,
        )
      ) {
        candidates.add(abs.origin + abs.pathname);
      }
    } catch {
      /* ignore bad hrefs */
    }
  }
  return [...candidates].slice(0, 10);
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
      bodyText: "",
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
      hero: { headline: null, subcopy: null, ctas: [], trustSignals: [] },
      conversion: {
        ctaTexts: [], telLinks: [], mailtoLinks: [], kakaoLinks: [], naverTalkLinks: [],
        bookingLinks: [], contactPageUrls: [], formCount: 0,
      },
      servicePages: [],
      schemaTypes: [],
      phones: [],
      addressHints: [],
      hasReviewSignal: false,
      hasMapEmbed: false,
      hasHours: false,
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
      .slice(0, 5)
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

  // ---- local / trust signals ----
  const schemaTypes = [
    ...new Set(
      [...combined.matchAll(/"@type"\s*:\s*"([^"]+)"/gi)].map((m) => m[1].trim()),
    ),
  ].slice(0, 20);

  const phoneSet = new Set<string>();
  for (const m of combined.matchAll(/tel:\+?([0-9\-() ]{7,})/gi)) {
    phoneSet.add(m[1].replace(/[()\s]/g, "").trim());
  }
  for (const m of text.matchAll(/(0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}|1\d{3}[-\s]?\d{4})/g)) {
    phoneSet.add(m[1].replace(/\s/g, ""));
  }
  const phones = [...phoneSet].slice(0, 5);

  const addrSet = new Set<string>();
  for (const m of text.matchAll(
    /((?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^,\n]{0,40}?(?:로|길)\s?\d{1,4}(?:[-\d]*)?)/g,
  )) {
    addrSet.add(m[1].trim());
  }
  const addressHints = [...addrSet].slice(0, 3);

  const hasReviewSignal =
    /aggregateRating|"Review"|ratingValue|reviewCount|리뷰|평점|별점|후기|★|⭐/i.test(
      combined,
    );
  const hasMapEmbed =
    /google\.com\/maps|maps\.google|map\.naver\.com|place\.map\.kakao|maps\.googleapis|map\.kakao\.com/i.test(
      combined,
    );
  const hasHours = /영업\s?시간|영업일|운영\s?시간|openingHours|평일\s?\d|주말\s?\d|월~금|오전\s?\d.*오후\s?\d/i.test(
    combined,
  );

  const fallbackHeadline = extractTags(home.html, "h2")[0]
    || extractTags(home.html, "strong").find((value) => value.length >= 5 && value.length <= 120)
    || null;
  const homeH1 = h1s[0] ?? fallbackHeadline;
  const homeParagraphs = extractTags(home.html, "p").filter((p) => p.length >= 12 && p.length <= 240);
  const heroText = stripTags(home.html).slice(0, 5000);
  const trustSignals = heroText
    .split(/[.!?。\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4 && s.length <= 100 && /고객사|후기|리뷰|인증|수상|누적|파트너|\d+[명건%]/i.test(s))
    .slice(0, 6);
  const ctaTexts = extractActionTexts(combined);
  const telLinks = hrefs.filter((h) => /^tel:/i.test(h));
  const mailtoLinks = hrefs.filter((h) => /^mailto:/i.test(h));
  const kakaoLinks = hrefs.filter((h) => /pf\.kakao\.com|center-pf\.kakao\.com|kakaotalk|kakao/i.test(h));
  const naverTalkLinks = hrefs.filter((h) => /talk\.naver\.com|booking\.naver\.com|smartplace\.naver\.com/i.test(h));
  const bookingLinks = hrefs.filter((h) => /calendly|tally|typeform|forms\.gle|docs\.google\.com\/forms|booking|reservation|예약/i.test(h));
  const contactPageUrls = hrefs.filter((h) => /(?:\/|^)(?:contact|inquiry|consulting|reservation|apply|문의|상담|신청|예약)(?:\/|$|[?#])/i.test(h));
  const servicePages = pages
    .filter((p) => SERVICE_PATH_PATTERN.test(new URL(p.finalUrl || p.url).pathname))
    .map((p) => {
      const bodyText = stripTags(p.html).slice(0, 12000);
      return {
        url: p.finalUrl || p.url,
        title: pageTitle(p.html),
        h1: extractTags(p.html, "h1")[0] ?? null,
        bodyText,
        ctaTexts: extractActionTexts(p.html),
        hasForm: /<form\b/i.test(p.html),
        hasContact: /contact|문의|상담|신청|예약/i.test(p.html),
      };
    })
    .slice(0, 5);

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
    bodyText: text.slice(0, 10000),
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
    hero: {
      headline: homeH1,
      subcopy: homeParagraphs[0] ?? null,
      ctas: extractActionTexts(home.html).slice(0, 6),
      trustSignals,
    },
    conversion: {
      ctaTexts,
      telLinks: [...new Set(telLinks)].slice(0, 8),
      mailtoLinks: [...new Set(mailtoLinks)].slice(0, 8),
      kakaoLinks: [...new Set(kakaoLinks)].slice(0, 8),
      naverTalkLinks: [...new Set(naverTalkLinks)].slice(0, 8),
      bookingLinks: [...new Set(bookingLinks)].slice(0, 8),
      contactPageUrls: [...new Set(contactPageUrls)].slice(0, 8),
      formCount: (combined.match(/<form\b/gi) || []).length,
    },
    servicePages,
    schemaTypes,
    phones,
    addressHints,
    hasReviewSignal,
    hasMapEmbed,
    hasHours,
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
