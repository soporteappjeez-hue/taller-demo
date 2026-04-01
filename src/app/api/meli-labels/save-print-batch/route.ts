import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface SavePrintBatchPayload {
  shipments: Array<{
    shipment_id: number;
    order_id: number;
    tracking_number: string | null;
    buyer_nickname: string | null;
    sku: string | null;
    variation: string | null;
    quantity: number;
    account_id: string;
    meli_user_id: string;
    shipping_method: "correo" | "flex" | "turbo" | "full";
  }>;
  pdf_base64: string;
  tzOffset: number;
}

// Server-side Supabase client con SERVICE_ROLE_KEY (permisos completos)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials");
}

const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseServiceKey || "placeholder-key"
);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SavePrintBatchPayload;
    const { shipments, pdf_base64, tzOffset } = body;

    if (!shipments || !Array.isArray(shipments) || shipments.length === 0) {
      return NextResponse.json(
        { success: false, error: "shipments es requerido" },
        { status: 400 }
      );
    }

    if (!pdf_base64) {
      return NextResponse.json(
        { success: false, error: "pdf_base64 es requerido" },
        { status: 400 }
      );
    }

    try {
      // Decodificar base64 a bytes
      const binaryString = Buffer.from(pdf_base64, "base64").toString("binary");
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Generar nombre de archivo
      const now = new Date();
      const offsetMs = (tzOffset || 0) * 3600000;
      const localTime = new Date(now.getTime() + offsetMs);

      const year = localTime.getUTCFullYear();
      const month = String(localTime.getUTCMonth() + 1).padStart(2, "0");
      const day = String(localTime.getUTCDate()).padStart(2, "0");
      const timestamp = Date.now();

      const fileName = `BATCH_${timestamp}.pdf`;
      const folderPath = `etiquetas/${year}-${month}-${day}`;
      const filePath = `${folderPath}/${fileName}`;

      // Usar cliente admin de Supabase (server-side) para upload
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("meli-labels")
        .upload(filePath, bytes, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        return NextResponse.json(
          { success: false, error: `Upload failed: ${uploadError.message}` },
          { status: 500 }
        );
      }

      // Obtener URL pública del archivo (usando cliente admin)
      const { data: publicData } = supabaseAdmin.storage
        .from("meli-labels")
        .getPublicUrl(filePath);

      const publicUrl = publicData?.publicUrl || filePath;

      // Preparar registros para insertar en printed_labels (también usar admin)
      const recordsToInsert = shipments.map((s) => ({
        shipment_id: s.shipment_id,
        order_id: s.order_id,
        tracking_number: s.tracking_number || null,
        buyer_nickname: s.buyer_nickname || null,
        sku: s.sku || null,
        variation: s.variation || null,
        quantity: s.quantity || 1,
        account_id: s.account_id,
        meli_user_id: s.meli_user_id,
        shipping_method: s.shipping_method,
        file_path: publicUrl,
        print_date: now.toISOString(),
        // Remover campos que no existen: source, synced_at
      }));

      // Insertar registros usando upsert (admin client)
      const { error: insertError } = await supabaseAdmin
        .from("printed_labels")
        .upsert(recordsToInsert, {
          onConflict: "shipment_id,meli_user_id",
        });

      if (insertError) {
        console.error("DB insert error:", insertError);
        return NextResponse.json(
          { success: false, error: `DB insert failed: ${insertError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        file_path: publicUrl,
        records_inserted: recordsToInsert.length,
      });
    } catch (innerErr) {
      console.error("Batch save processing error:", innerErr);
      return NextResponse.json(
        {
          success: false,
          error: innerErr instanceof Error ? innerErr.message : "Processing error",
        },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("Save-print-batch endpoint error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
