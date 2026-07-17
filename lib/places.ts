/**
 * Real Google Maps / Business Profile verification via Google Places API (v1).
 *
 * Why: the old local-SEO module only guessed ("수동확인") — it never actually
 * checked Google, so a business that IS on Google Maps was reported as
 * "확인 불가". This module performs a REAL lookup and returns the live data
 * (name / address / phone / rating / review count / business status / maps URL),
 * so the diagnosis and guidance are based on what Google actually shows.
 *
 * Setup: set env GOOGLE_PLACES_API_KEY (Places API "Text Search (New)" enabled).
 * Without a key, `performed=false` and the UI falls back to a manual verify link
 * — but it no longer falsely claims the panel doesn't exist.
 */

export type PlaceMatch = {
  name: string;
  address: string;
  phone: string;
  rating: number | null;
  reviewCount: number | null;
  businessStatus: string;
  mapsUri: string;
  websiteUri: string;
  primaryType: string;
  /** confidence the match is the same business as the diagnosed site */
  confidence: "high" | "medium" | "low";
};

export type PlacesResult = {
  performed: boolean;
  method: "google_places" | "none";
  reason?: string;
  found: boolean;
  match: PlaceMatch | null;
  candidates: number;
  query: string;
};

function hostOf(u: string): string {
  try {
    return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "");
  } catch {
    return u.replace(/^www\./, "");
  }
}

type PlacesApiPlace = {
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  googleMapsUri?: string;
  websiteUri?: string;
  primaryTypeDisplayName?: { text?: string };
};

/**
 * Look up a business on Google Maps.
 * @param brand company/brand name
 * @param region optional region hint (서울, 서초구 ...) to disambiguate
 * @param hostname diagnosed site hostname (to match the right place)
 */
export async function checkGooglePlace(opts: {
  brand: string;
  region?: string;
  hostname: string;
  service?: string;
}): Promise<PlacesResult> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const query = [opts.brand, opts.region, opts.service].filter(Boolean).join(" ").trim();

  if (!key) {
    return {
      performed: false,
      method: "none",
      reason:
        "GOOGLE_PLACES_API_KEY 미설정 — 구글 맵 자동 조회를 하지 않았습니다. 아래 확인 링크로 직접 검증하거나, 서버에 Places API 키를 설정하면 자동 진단됩니다.",
      found: false,
      match: null,
      candidates: 0,
      query,
    };
  }

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.rating,places.userRatingCount,places.businessStatus,places.googleMapsUri,places.websiteUri,places.primaryTypeDisplayName",
      },
      body: JSON.stringify({ textQuery: query, languageCode: "ko", regionCode: "KR", maxResultCount: 5 }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return {
        performed: true,
        method: "google_places",
        reason: `Places API 오류 (HTTP ${res.status}) — 키·결제·API 활성화 상태를 확인하세요.`,
        found: false,
        match: null,
        candidates: 0,
        query,
      };
    }

    const data = (await res.json()) as { places?: PlacesApiPlace[] };
    const places = data.places ?? [];
    if (!places.length) {
      return {
        performed: true,
        method: "google_places",
        found: false,
        match: null,
        candidates: 0,
        query,
      };
    }

    const targetHost = hostOf(opts.hostname);
    // pick best match: prefer website-host match, then name containment
    let best: PlacesApiPlace | null = null;
    let bestConf: PlaceMatch["confidence"] = "low";
    for (const p of places) {
      const pHost = p.websiteUri ? hostOf(p.websiteUri) : "";
      const nameHit = (p.displayName?.text || "").replace(/\s/g, "").includes(opts.brand.replace(/\s/g, ""));
      if (pHost && targetHost && (pHost === targetHost || pHost.endsWith(targetHost) || targetHost.endsWith(pHost))) {
        best = p; bestConf = "high"; break;
      }
      if (!best && nameHit) { best = p; bestConf = "medium"; }
    }
    if (!best) { best = places[0]; bestConf = "low"; }

    const match: PlaceMatch = {
      name: best.displayName?.text || opts.brand,
      address: best.formattedAddress || "",
      phone: best.nationalPhoneNumber || best.internationalPhoneNumber || "",
      rating: typeof best.rating === "number" ? best.rating : null,
      reviewCount: typeof best.userRatingCount === "number" ? best.userRatingCount : null,
      businessStatus: best.businessStatus || "",
      mapsUri: best.googleMapsUri || "",
      websiteUri: best.websiteUri || "",
      primaryType: best.primaryTypeDisplayName?.text || "",
      confidence: bestConf,
    };

    return {
      performed: true,
      method: "google_places",
      found: true,
      match,
      candidates: places.length,
      query,
    };
  } catch (e) {
    return {
      performed: true,
      method: "google_places",
      reason: "Places API 호출 실패 (네트워크/타임아웃).",
      found: false,
      match: null,
      candidates: 0,
      query,
    };
  }
}
