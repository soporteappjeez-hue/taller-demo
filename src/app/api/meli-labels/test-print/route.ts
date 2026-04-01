import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials");
}

const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseServiceKey || "placeholder-key"
);

// Datos mock para etiqueta de prueba
// Usamos ID numérico alto para no conflijar con IDs reales de MeLi
const TEST_LABEL_DATA = {
  shipment_id: 99999999,
  order_id: 99999999,
  sku: "TEST-SKU-PROTOTIPO",
  buyer_nickname: "USUARIO_TEST",
  quantity: 5,
  variation: "Color: Azul / Tamaño: Grande",
  shipping_method: "flex",
  account_id: "TEST_ACCOUNT",
  meli_user_id: "TEST_USER_123",
};

function generateTestPDF(): Uint8Array {
  const doc = new jsPDF();
  
  // Fondo
  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, 210, 297, "F");
  
  // Borde de prueba
  doc.setDrawColor(57, 255, 20);
  doc.setLineWidth(3);
  doc.rect(10, 10, 190, 277);
  
  // Título
  doc.setFontSize(24);
  doc.setTextColor(57, 255, 20);
  doc.setFont("helvetica", "bold");
  doc.text("ESTO ES UNA ETIQUETA DE PRUEBA", 105, 50, { align: "center" });
  
  // Subtítulo
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("MODO SANDBOX - NO VALIDO PARA ENVIO", 105, 65, { align: "center" });
  
  // Línea separadora
  doc.setDrawColor(57, 255, 20);
  doc.setLineWidth(1);
  doc.line(20, 75, 190, 75);
  
  // Datos del shipment
  doc.setFontSize(12);
  doc.setTextColor(200, 200, 200);
  doc.setFont("helvetica", "normal");
  
  const startY = 90;
  const lineHeight = 12;
  const data = [
    ["SHIPMENT ID:", String(TEST_LABEL_DATA.shipment_id)],
    ["ORDER ID:", String(TEST_LABEL_DATA.order_id)],
    ["SKU:", TEST_LABEL_DATA.sku],
    ["COMPRADOR:", TEST_LABEL_DATA.buyer_nickname],
    ["CANTIDAD:", `${TEST_LABEL_DATA.quantity} unidades`],
    ["VARIACION:", TEST_LABEL_DATA.variation],
    ["METODO:", TEST_LABEL_DATA.shipping_method.toUpperCase()],
    ["CUENTA:", TEST_LABEL_DATA.account_id],
  ];
  
  data.forEach(([label, value], index) => {
    const y = startY + (index * lineHeight);
    doc.setTextColor(150, 150, 150);
    doc.text(label, 25, y);
    doc.setTextColor(255, 255, 255);
    doc.text(value, 90, y);
  });
  
  // QR Code placeholder (rectángulo)
  doc.setFillColor(255, 255, 255);
  doc.rect(140, 200, 50, 50, "F");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("QR CODE", 165, 225, { align: "center" });
  
  // Footer
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generado: ${new Date().toLocaleString("es-AR")}`, 105, 280, { align: "center" });
  doc.text("App Jeez - Modo Test", 105, 286, { align: "center" });
  
  return doc.output("arraybuffer") as unknown as Uint8Array;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Generar PDF de prueba
    const pdfBytes = generateTestPDF();
    
    // 2. Subir a Storage en carpeta /test/
    const fileName = `TEST-${Date.now()}.pdf`;
    const filePath = `test/${fileName}`;
    
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("meli-labels")
      .upload(filePath, pdfBytes, {
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
    
    // 3. Obtener URL pública
    const { data: publicData } = supabaseAdmin.storage
      .from("meli-labels")
      .getPublicUrl(filePath);
    
    const publicUrl = publicData?.publicUrl || filePath;
    
    // 4. Insertar en printed_labels
    const now = new Date();
    const recordToInsert = {
      shipment_id: TEST_LABEL_DATA.shipment_id,
      order_id: TEST_LABEL_DATA.order_id,
      tracking_number: null,
      buyer_nickname: TEST_LABEL_DATA.buyer_nickname,
      sku: TEST_LABEL_DATA.sku,
      variation: TEST_LABEL_DATA.variation,
      quantity: TEST_LABEL_DATA.quantity,
      account_id: TEST_LABEL_DATA.account_id,
      meli_user_id: TEST_LABEL_DATA.meli_user_id,
      shipping_method: TEST_LABEL_DATA.shipping_method,
      file_path: publicUrl,
      print_date: now.toISOString(),
    };
    
    // Intentar upsert primero (por si ya existe de pruebas anteriores)
    const { error: insertError } = await supabaseAdmin
      .from("printed_labels")
      .upsert([recordToInsert], {
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
      test_data: TEST_LABEL_DATA,
      message: "Etiqueta de prueba creada exitosamente",
    });
    
  } catch (err) {
    console.error("Test-print endpoint error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
