import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MELI_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  const FRONTEND_URL =
    Deno.env.get("APPJEEZ_FRONTEND_URL") ??
    "https://taller-motos-app-two.vercel.app/configuracion/meli";

  const redirectError = (message: string) =>
    Response.redirect(`${FRONTEND_URL}?status=error&message=${message}`, 302);

  /* ── 1. Sólo aceptar GET ── */
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  /* ── 2. Extraer el código de autorización ── */
  const code = url.searchParams.get("code");
  if (!code) {
    return new Response(
      JSON.stringify({ error: "Missing authorization code" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  /* ── 3. Leer credenciales desde variables de entorno ── */
  const appId = Deno.env.get("APPJEEZ_MELI_APP_ID");
  const secretKey = Deno.env.get("APPJEEZ_MELI_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!appId || !secretKey || !supabaseUrl || !serviceRoleKey) {
    console.error("Missing required environment variables");
    return redirectError("config_error");
  }

  /* ── 4. Construir la redirect_uri exacta de esta función ── */
  const callbackUri = `${url.protocol}//${url.host}${url.pathname}`;

  /* ── 5. Intercambio de código por tokens (server-side seguro) ── */
  let tokenData: {
    access_token: string;
    refresh_token: string;
    user_id: number;
    expires_in: number;
    token_type: string;
  };

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: appId,
      client_secret: secretKey,
      code,
      redirect_uri: callbackUri,
    });

    const tokenRes = await fetch(MELI_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("MeLi token exchange failed:", tokenRes.status, errText);
      return redirectError("auth_failed");
    }

    tokenData = await tokenRes.json();
  } catch (err) {
    console.error("Network error during token exchange:", err);
    return redirectError("network_error");
  }

  /* ── 6. Calcular fecha de expiración ── */
  const expiresAt = new Date(
    Date.now() + tokenData.expires_in * 1000
  ).toISOString();

  /* ── 7. Guardar / actualizar en Supabase (bypass RLS con service_role) ── */
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { error: dbError } = await supabase
    .from("meli_accounts")
    .upsert(
      {
        meli_user_id: String(tokenData.user_id),
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        token_type: tokenData.token_type ?? "Bearer",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "meli_user_id" }
    );

  if (dbError) {
    console.error("Supabase upsert error:", dbError);
    return redirectError("db_error");
  }

  /* ── 8. Redirigir al frontend con éxito ── */
  return Response.redirect(
    `${FRONTEND_URL}?status=success&user_id=${tokenData.user_id}`,
    302
  );
});
