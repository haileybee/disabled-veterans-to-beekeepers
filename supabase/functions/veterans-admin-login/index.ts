import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://haileybee.github.io",
  "http://localhost:8000",
  "http://localhost:8080",
  "http://127.0.0.1:8000",
  "http://127.0.0.1:8080",
]);

const LOGIN_SETTING_KEY = "admin_login_primary";
const BOOTSTRAP_SALT = "ed6fc7c17210d9f70c4c44e13f0f34ef";
const BOOTSTRAP_HASH = "fdd0dba2daab680fe588d99cce8e6795510f763ff97ee947d3d488e80cc1ba8e";

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://haileybee.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors(req) });
}

function normalizeUsername(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function bootstrapMatches(password: string) {
  const candidate = await sha256Hex(`${BOOTSTRAP_SALT}${password}`);
  return constantTimeEqual(candidate, BOOTSTRAP_HASH);
}

async function readLoginConfig(admin: ReturnType<typeof createClient>) {
  const { data, error } = await admin
    .from("veterans_site_settings")
    .select("value_json")
    .eq("key", LOGIN_SETTING_KEY)
    .maybeSingle();
  if (error) throw error;
  const config = (data?.value_json || {}) as Record<string, unknown>;
  const username = String(config.username || "").trim();
  const email = normalizeEmail(config.email);
  return { username, email, bootstrapUsed: Boolean(config.bootstrap_used), raw: config };
}

async function writeBootstrapUsed(admin: ReturnType<typeof createClient>, config: Record<string, unknown>, used: boolean) {
  const { error } = await admin
    .from("veterans_site_settings")
    .update({ value_json: { ...config, bootstrap_used: used }, updated_at: new Date().toISOString() })
    .eq("key", LOGIN_SETTING_KEY);
  if (error) throw error;
}

async function ensureApproved(admin: ReturnType<typeof createClient>, email: string) {
  const { data, error } = await admin
    .from("veterans_admins")
    .select("id,email,role,active")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function genericFailure(req: Request) {
  await new Promise((resolve) => setTimeout(resolve, 260));
  return json(req, { error: "Invalid username or password." }, 401);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const origin = req.headers.get("origin") || "";
  if (origin && !allowedOrigins.has(origin)) return json(req, { error: "Origin not allowed." }, 403);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRole || !anonKey) return json(req, { error: "Admin login is not configured." }, 500);

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const publicAuth = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action || "login");
    const config = await readLoginConfig(admin);
    if (!config.username || !config.email) return json(req, { error: "Admin login is not configured." }, 500);

    if (action === "password_changed") {
      const authorization = req.headers.get("authorization") || "";
      const token = authorization.replace(/^Bearer\s+/i, "").trim();
      if (!token) return json(req, { error: "Please sign in again." }, 401);

      const { data: userData, error: userError } = await admin.auth.getUser(token);
      const user = userData.user;
      if (userError || !user?.email || normalizeEmail(user.email) !== config.email) {
        return json(req, { error: "Your sign-in session is invalid or expired." }, 401);
      }
      const approved = await ensureApproved(admin, config.email);
      if (!approved) return json(req, { error: "Admin access is not approved." }, 403);

      const newPassword = String(payload.newPassword || "");
      if (newPassword.length < 12 || newPassword.length > 128) {
        return json(req, { error: "Use a new password that is at least 12 characters long." }, 400);
      }

      const appMetadata = { ...(user.app_metadata || {}), veterans_password_change_required: false };
      const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
        password: newPassword,
        app_metadata: appMetadata,
      });
      if (updateError) throw updateError;
      await writeBootstrapUsed(admin, config.raw, true);
      return json(req, { ok: true });
    }

    if (action !== "login") return json(req, { error: "Unknown action." }, 400);

    const username = normalizeUsername(payload.username);
    const password = String(payload.password || "");
    if (!username || !password || username !== normalizeUsername(config.username)) return genericFailure(req);

    const approved = await ensureApproved(admin, config.email);
    if (!approved) return genericFailure(req);

    const direct = await publicAuth.auth.signInWithPassword({ email: config.email, password });
    if (!direct.error && direct.data.session) {
      if (!config.bootstrapUsed) await writeBootstrapUsed(admin, config.raw, true);
      return json(req, {
        access_token: direct.data.session.access_token,
        refresh_token: direct.data.session.refresh_token,
        must_change_password: Boolean(direct.data.user?.app_metadata?.veterans_password_change_required),
      });
    }

    if (config.bootstrapUsed || !(await bootstrapMatches(password))) return genericFailure(req);

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: config.email,
    });
    if (linkError) throw linkError;

    const linkedUser = linkData.user;
    if (!linkedUser?.id) throw new Error("Unable to prepare the admin account.");

    const appMetadata = { ...(linkedUser.app_metadata || {}), veterans_password_change_required: true };
    const { error: metadataError } = await admin.auth.admin.updateUserById(linkedUser.id, { app_metadata: appMetadata });
    if (metadataError) throw metadataError;

    const props = linkData.properties as { hashed_token?: string; action_link?: string } | undefined;
    let tokenHash = String(props?.hashed_token || "");
    if (!tokenHash && props?.action_link) {
      try { tokenHash = new URL(props.action_link).searchParams.get("token") || ""; } catch { tokenHash = ""; }
    }
    if (!tokenHash) throw new Error("Unable to create the one-time admin session.");

    const verified = await publicAuth.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (verified.error || !verified.data.session) throw verified.error || new Error("Unable to create the one-time admin session.");

    return json(req, {
      access_token: verified.data.session.access_token,
      refresh_token: verified.data.session.refresh_token,
      must_change_password: true,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Admin login failed");
    return json(req, { error: "Admin login failed. Please try again." }, 500);
  }
});
