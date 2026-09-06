// Server-side proxy for every OMDb request the app makes. Two jobs:
//
// 1. Keep the real OMDb API key out of client bundles entirely — it's read
//    here from the OMDB_API_KEY secret (set on this function only), never
//    sent to or stored in the browser.
// 2. Increment one shared, app-wide daily usage counter (see
//    supabase/schema.sql's omdb_usage table). There's a single OMDb key for
//    the whole app and one shared 1,000-requests/day cap it draws from, so
//    usage has to be tracked centrally — not per browser/device/user.
//
// Deploy via the Supabase Dashboard (no CLI needed):
//   1. Edge Functions -> Create a new function -> name it exactly
//      "omdb-proxy" -> paste this file's contents -> Deploy.
//   2. Leave "Enforce JWT verification" ON (the default) — that's what
//      keeps this callable only by signed-in app users, not the open
//      internet.
//   3. Edge Functions -> omdb-proxy -> Secrets -> add OMDB_API_KEY with
//      your real OMDb key as the value (the one currently in your local
//      .env as VITE_OMDB_API_KEY — it can be removed from .env after this,
//      since the client no longer needs or uses it).
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically to
// every Edge Function — nothing to configure for those two.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const OMDB_BASE_URL = "https://www.omdbapi.com/";
const OMDB_API_KEY = Deno.env.get("OMDB_API_KEY");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (!OMDB_API_KEY) {
    // Mirrors OMDb's own "no results" shape (Response: "False" + Error) so
    // the client's existing parsing/error handling needs no special case
    // for "the server has no key configured" versus "OMDb itself errored".
    return json({ Response: "False", Error: "OMDb is not configured on the server." });
  }

  let params: Record<string, string>;
  try {
    const body = await req.json();
    params = body?.params ?? {};
  } catch {
    return json({ Response: "False", Error: "Invalid request." }, 400);
  }

  const url = new URL(OMDB_BASE_URL);
  url.searchParams.set("apikey", OMDB_API_KEY);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  let omdbRes: Response;
  try {
    omdbRes = await fetch(url.toString());
  } catch {
    return json({ Response: "False", Error: "Couldn't reach OMDb." }, 502);
  }

  const data = await omdbRes.json();

  // Counted here — a response was actually received from OMDb's server, so
  // it consumed real quota — regardless of whether OMDb's own answer was
  // Response: "True" or "False". Best-effort: a failure to record usage
  // should never hide the actual OMDb result from the user.
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { error } = await admin.rpc("increment_omdb_usage");
    if (error) console.error("increment_omdb_usage failed", error);
  } catch (err) {
    console.error("Failed to increment omdb_usage", err);
  }

  return json(data, omdbRes.status);
});
