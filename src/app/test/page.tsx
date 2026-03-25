"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ordersDb } from "@/lib/db";
import { generateId } from "@/lib/utils";

interface Result {
  test: string;
  ok: boolean;
  detail: string;
}

export default function TestPage() {
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(false);
  const [saveResult, setSaveResult] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const testSaveOrder = async () => {
    setSaving(true);
    setSaveResult("Guardando...");
    try {
      await ordersDb.create({
        id: generateId(),
        clientName: "Cliente de Prueba",
        clientPhone: "5491100000001",
        motorType: "4T",
        brand: "Honda",
        model: "CG 150",
        reportedIssues: "Prueba desde formulario",
        budget: 5000,
        estimatedDays: 3,
        status: "ingresado",
        clientNotification: "pendiente_de_aviso",
        budgetAccepted: false,
        entryDate: new Date().toISOString(),
        completionDate: null,
        deliveryDate: null,
        linkedParts: [],
        internalNotes: "Test",
      });
      setSaveResult("✅ ORDEN GUARDADA — Revisá la tabla reparaciones en Supabase");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSaveResult(`❌ ERROR: ${msg}`);
    }
    setSaving(false);
  };

  const run = async () => {
    setRunning(true);
    const out: Result[] = [];

    // 1. Variables de entorno
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    out.push({
      test: "Variables de entorno",
      ok: !!url && !!key,
      detail: url
        ? `URL: ${url} | KEY: ${key?.slice(0, 20)}...`
        : "FALTAN variables NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY",
    });

    // 2. Ping a Supabase — leer tabla
    try {
      const { data, error } = await supabase
        .from("reparaciones")
        .select("id")
        .limit(1);
      out.push({
        test: "Leer tabla reparaciones",
        ok: !error,
        detail: error
          ? `Error: ${error.message} | Código: ${error.code} | Hint: ${error.hint}`
          : `OK — ${data?.length ?? 0} fila(s) encontradas`,
      });
    } catch (e) {
      out.push({ test: "Leer tabla reparaciones", ok: false, detail: String(e) });
    }

    // 3. Insertar fila de prueba
    const testId = "test-" + Date.now();
    try {
      const { error } = await supabase.from("reparaciones").insert({
        id:                  testId,
        client_name:         "TEST CLIENTE",
        client_phone:        "5491100000000",
        motor_type:          "4T",
        brand:               "TestBrand",
        model:               "TestModel",
        reported_issues:     "Prueba de conexion",
        budget:              null,
        estimated_days:      null,
        status:              "ingresado",
        client_notification: "pendiente_de_aviso",
        budget_accepted:     false,
        entry_date:          new Date().toISOString(),
        completion_date:     null,
        delivery_date:       null,
        linked_parts:        [],
        internal_notes:      "",
      });
      out.push({
        test: "Insertar fila de prueba",
        ok: !error,
        detail: error
          ? `Error: ${error.message} | Código: ${error.code} | Hint: ${error.hint}`
          : "Fila insertada correctamente",
      });

      // 4. Borrar fila de prueba
      if (!error) {
        const { error: delErr } = await supabase
          .from("reparaciones")
          .delete()
          .eq("id", testId);
        out.push({
          test: "Borrar fila de prueba",
          ok: !delErr,
          detail: delErr ? delErr.message : "Fila borrada correctamente",
        });
      }
    } catch (e) {
      out.push({ test: "Insertar fila de prueba", ok: false, detail: String(e) });
    }

    setResults(out);
    setRunning(false);
  };

  useEffect(() => { run(); }, []);

  return (
    <div className="min-h-screen bg-gray-950 p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-black text-orange-400 mb-6">
        Diagnóstico de Conexión — Supabase
      </h1>

      <button
        onClick={run}
        disabled={running}
        className="btn-primary mb-6"
      >
        {running ? "Probando..." : "Volver a probar"}
      </button>

      {/* Test guardar orden real */}
      <div className="card mb-6 space-y-3">
        <p className="text-white font-bold">Prueba directa: guardar orden en reparaciones</p>
        <button
          onClick={testSaveOrder}
          disabled={saving}
          className="btn-whatsapp btn w-full"
        >
          {saving ? "Guardando..." : "Guardar orden de prueba ahora"}
        </button>
        {saveResult && (
          <p className={`text-sm font-mono p-3 rounded-xl ${saveResult.startsWith("✅") ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"}`}>
            {saveResult}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {results.map((r) => (
          <div
            key={r.test}
            className={`rounded-2xl border p-4 ${
              r.ok
                ? "bg-green-950/40 border-green-700"
                : "bg-red-950/40 border-red-600"
            }`}
          >
            <div className="flex items-center gap-3 mb-1">
              <span className={`text-xl ${r.ok ? "text-green-400" : "text-red-400"}`}>
                {r.ok ? "✅" : "❌"}
              </span>
              <span className="text-white font-bold">{r.test}</span>
            </div>
            <p className={`text-sm font-mono break-all ${r.ok ? "text-green-300" : "text-red-300"}`}>
              {r.detail}
            </p>
          </div>
        ))}
        {running && (
          <div className="card flex items-center gap-3 text-gray-400">
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            Ejecutando pruebas...
          </div>
        )}
      </div>
    </div>
  );
}
