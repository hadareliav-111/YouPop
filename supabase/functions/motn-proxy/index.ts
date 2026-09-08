// Server-side proxy for Movie of the Night's Streaming Availability API,
// used only by the "Where to Watch" section's Israel-only lookups. Two
// jobs, mirroring omdb-proxy exactly:
//
// 1. Keep the real API key out of client bundles entirely — read here
//    from the MOTN_API_KEY secret (set on this function only), never
//    sent to or stored in the browser.
// 2. Resolve an IMDb id for the requested title — already the
//    externalId itself for OMDb movies; for TVmaze shows, TVmaze's own
//    numeric id isn't an IMDb id, so this makes one extra, free, keyless
//    TVmaze lookup to get one (see resolveImdbId below) — call Movie of
//    the Night for Israel-only availability, and persist the result
//    (success OR a genuinely-empty answer) into the shared
//    where_to_watch_cache table via the service-role connection, so a
//    future request for the same title never has to call this function,
//    TVmaze, or Movie of the Night again.
//
// Deploy via the Supabase Dashboard, same steps as omdb-proxy:
//   1. Edge Functions -> Create a new function -> name it exactly
//      "motn-proxy" -> paste this file's contents -> Deploy.
//   2. Leave "Enforce JWT verification" ON (the default) — that's what
//      keeps this callable only by signed-in app users, not the open
//      internet.
//   3. Edge Functions -> motn-proxy -> Secrets -> add MOTN_API_KEY with
//      your Movie of the Night API key.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically to
// every Edge Function — nothing to configure for those two.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const MOTN_BASE_URL = "https://api.movieofthenight.com/v4";
const MOTN_API_KEY = Deno.env.get("MOTN_API_KEY");
const COUNTRY = "il";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// The one shape the client actually needs — deliberately excludes
// availability type (subscription/rent/buy/free): the UI never shows it
// (see WhereToWatch.tsx), it's only used internally below to pick the
// single best link when a provider appears more than once for a title.
interface Provider {
  id: string;
  name: string;
  logoUrl: string | null;
  link: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

interface MotnStreamingOption {
  service: {
    id: string;
    name: string;
    // The app has exactly one appearance (dark) — see index.css's design
    // tokens — so the dark-theme logo variant is always the right one;
    // whiteImage is a fallback for any service that omits it.
    imageSet?: { darkThemeImage?: string; whiteImage?: string };
  };
  type: string;
  link: string;
}

// Some providers show up more than once for the same title (e.g. Apple TV
// offering both a rent and a buy option) — the UI only ever shows one
// chip per provider, so this picks the single most useful link per
// service: prefer already-included access (subscription/free) over
// having to pay again (buy/rent), addon last.
const TYPE_PRIORITY: Record<string, number> = {
  subscription: 0,
  free: 1,
  buy: 2,
  rent: 3,
  addon: 4,
};

function toProviders(options: MotnStreamingOption[]): Provider[] {
  const bestByService = new Map<string, MotnStreamingOption>();
  for (const opt of options) {
    const existing = bestByService.get(opt.service.id);
    if (!existing || (TYPE_PRIORITY[opt.type] ?? 99) < (TYPE_PRIORITY[existing.type] ?? 99)) {
      bestByService.set(opt.service.id, opt);
    }
  }
  return Array.from(bestByService.values()).map((opt) => ({
    id: opt.service.id,
    name: opt.service.name,
    logoUrl: opt.service.imageSet?.darkThemeImage ?? opt.service.imageSet?.whiteImage ?? null,
    link: opt.link,
  }));
}

// TVmaze's own numeric show id (already stored as externalId for every
// TV WatchlistItem/Recommendation) isn't an IMDb id — this makes the one
// extra, free, keyless TVmaze call needed to resolve one, exactly the
// same lookup tvmaze.ts's own getDetails() already makes client-side for
// OMDb ratings enrichment, just server-side here. Movies need no
// resolution at all: OMDb's externalId already is a real IMDb id.
async function resolveImdbId(externalSource: string, externalId: string): Promise<string | null> {
  if (externalSource === "omdb") return externalId;
  if (externalSource !== "tvmaze") return null;

  try {
    const res = await fetch(`https://api.tvmaze.com/shows/${externalId}`);
    if (!res.ok) return null;
    const show = await res.json();
    return show?.externals?.imdb ?? null;
  } catch {
    return null;
  }
}

async function cacheResult(
  admin: ReturnType<typeof createClient>,
  externalSource: string,
  externalId: string,
  providers: Provider[],
): Promise<void> {
  const { error } = await admin.from("where_to_watch_cache").upsert({
    external_source: externalSource,
    external_id: externalId,
    country: COUNTRY,
    streaming_options: providers,
  });
  if (error) console.error("Failed to cache where_to_watch result", error);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (!MOTN_API_KEY) {
    return json({ providers: [], error: "Movie of the Night is not configured on the server." });
  }

  let externalSource: string;
  let externalId: string;
  try {
    const body = await req.json();
    externalSource = body?.externalSource;
    externalId = body?.externalId;
    if (!externalSource || !externalId) throw new Error("missing fields");
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // mock-movie is the dev-only, keyless fallback used when OMDb isn't
  // configured — it has no real IMDb id and nothing real to look up, so
  // there's nothing worth caching either; just answer "nothing" directly.
  if (externalSource === "mock-movie") {
    return json({ providers: [] });
  }

  const imdbId = await resolveImdbId(externalSource, externalId);
  if (!imdbId) {
    // A real, legitimate answer (this title has no IMDb id we can
    // resolve, e.g. some TVmaze shows never get one) — cache it so we
    // don't retry the TVmaze lookup every time, exactly like a genuine
    // "no availability" result.
    await cacheResult(admin, externalSource, externalId, []);
    return json({ providers: [] });
  }

  let motnRes: Response;
  try {
    motnRes = await fetch(`${MOTN_BASE_URL}/shows/${imdbId}?country=${COUNTRY}`, {
      headers: { "X-API-Key": MOTN_API_KEY },
    });
  } catch {
    // Network failure reaching Movie of the Night — a real error, not an
    // answer. Don't cache this; the client should be free to retry later.
    return json({ error: "Couldn't reach Movie of the Night." }, 502);
  }

  if (motnRes.status === 404) {
    // A real, legitimate "we don't know this title at all" answer.
    await cacheResult(admin, externalSource, externalId, []);
    return json({ providers: [] });
  }

  if (!motnRes.ok) {
    // Any other failure (bad/missing key, quota exhausted, etc.) is a
    // real error — never cache a false "not available" for this.
    return json({ error: `Movie of the Night request failed (${motnRes.status}).` }, 502);
  }

  const data = await motnRes.json();
  const options: MotnStreamingOption[] = data?.streamingOptions?.[COUNTRY] ?? [];
  const providers = toProviders(options);

  await cacheResult(admin, externalSource, externalId, providers);
  return json({ providers });
});
