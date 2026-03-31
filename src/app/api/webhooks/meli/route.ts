import { NextRequest, NextResponse } from "next/server";
import { verifyMeliWebhookSignature } from "@/lib/webhookSignature";
import { getNotificationManager } from "@/lib/notificationManager";
import { supabase } from "@/lib/supabase";

/**
 * POST /api/webhooks/meli
 * Recibe notificaciones de Mercado Libre (Webhooks)
 * Topic: questions, orders_v2, etc.
 *
 * MeLi envía:
 * - Header X-SIGNATURE: sha256=<hmac>
 * - Body: { resource, user_id, topic, ... }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Obtener firma del header
    const signature = request.headers.get("X-SIGNATURE");
    if (!signature) {
      console.warn("[WEBHOOK] Firma no encontrada");
      return NextResponse.json({ error: "Signature missing" }, { status: 401 });
    }

    // 2. Leer body como string para validar firma
    const body = await request.text();
    const secret = process.env.MELI_WEBHOOK_SECRET;

    if (!secret) {
      console.error("[WEBHOOK] MELI_WEBHOOK_SECRET no configurado");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // 3. Verificar firma HMAC
    const isValid = verifyMeliWebhookSignature(body, signature, secret);
    if (!isValid) {
      console.warn("[WEBHOOK] Firma inválida. Rechazando.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 4. Parsear payload
    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { resource, user_id, topic, action } = payload;

    console.log(`[WEBHOOK] Notificación recibida - Topic: ${topic}, User: ${user_id}, Resource: ${resource}`);

    // 5. Procesar solo preguntas por ahora
    if (topic === "questions") {
      // Guardar en base de datos
      const { error: dbError } = await supabase.from("notifications").insert({
        meli_user_id: String(user_id),
        topic: topic,
        resource: String(resource),
        data: payload,
        received_at: new Date().toISOString(),
      });

      if (dbError) {
        console.error("[WEBHOOK] Error guardando notificación:", dbError);
      }

      // Broadcast a clientes SSE
      const notificationManager = getNotificationManager();
      notificationManager.broadcast({
        user_id: String(user_id),
        topic: topic,
        resource: String(resource),
        data: payload,
        timestamp: new Date().toISOString(),
      });

      console.log("[WEBHOOK] Notificación procesada y broadcast enviado");
    }

    // 6. Retornar 200 OK inmediatamente (MeLi necesita confirmación rápida)
    // MeLi reintentará si no recibe 200 OK en los primeros segundos
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("[WEBHOOK] Error procesando webhook:", error);
    // Retornar 200 de todas formas para que MeLi no reintente
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }
}

/**
 * GET /api/webhooks/meli?challenge=xyz
 * MeLi envía esto para verificar que el endpoint existe
 * Solo retornamos el challenge
 */
export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get("challenge");

  if (!challenge) {
    return NextResponse.json({ error: "Challenge missing" }, { status: 400 });
  }

  console.log("[WEBHOOK] Challenge verificado");
  return NextResponse.json({ challenge });
}
