"use client";

import { useRef, useState } from "react";
import { WorkOrder, MOTOR_TYPE_LABELS } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { X, Download, MessageCircle, Printer, Loader2, Plus, Trash2, Image as ImageIcon } from "lucide-react";

interface Props { order: WorkOrder; onClose: () => void; }
interface LineItem { desc: string; qty: number; unitPrice: number; }

function fmt(n: number) {
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const EMPRESA = {
  nombre: "MAQJEEZ",
  slogan: "Soluciones en Maquinaria",
  cuit:   "20-31264840-8",
  dir:    "Constancio Vigil 150, Carlos Spegazzini",
  loc:    "Partido de Ezeiza, Buenos Aires",
  tel:    "11 5900-0486 / 11 2181-6064",
};

const CLAUSULA_90 =
  "Transcurridos los 90 días del aviso de retiro, la unidad se considerará en abandono, facultando al taller a proceder a su venta para cubrir gastos de almacenaje y reparación según los Art. 2525 y 2526 del Código Civil y Comercial de la Nación (Ley de Depósito).";

const CLAUSULA_DIAG =
  "El presupuesto de diagnóstico tiene un costo de $20.000. Si la reparación no se realiza en el momento, este monto es válido como crédito durante 60 días, descontándose del total si el cliente decide reparar la máquina más adelante.";

export default function BudgetImage({ order, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [items, setItems] = useState<LineItem[]>([
    { desc: "Mano de obra — " + (order.reportedIssues || "Reparación"), qty: 1, unitPrice: order.budget ?? 0 },
  ]);
  const [discount, setDiscount] = useState(0);
  const [discType, setDiscType] = useState<"$" | "%">("$");
  const [noPresup, setNoPresup] = useState(order.id.slice(0, 8).toUpperCase());
  const [notifDate, setNotifDate] = useState(new Date().toISOString().split("T")[0]);

  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const descAmt = discType === "$" ? discount : Math.round(subtotal * discount / 100);
  const total = subtotal - descAmt;

  const addItem = () => setItems([...items, { desc: "", qty: 1, unitPrice: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const upd = (i: number, f: keyof LineItem, v: string) =>
    setItems(items.map((it, idx) => idx === i ? { ...it, [f]: f === "desc" ? v : Number(v) || 0 } : it));

  const generate = async () => {
    if (!ref.current) return;
    setGenerating(true);
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(ref.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });
      setImageUrl(url);
    } catch (e) { alert("Error al generar imagen: " + e); }
    setGenerating(false);
  };

  const download = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `presupuesto-${order.clientName.replace(/\s+/g, "-")}-${noPresup}.png`;
    a.click();
  };

  const sendWhatsApp = () => {
    const text = encodeURIComponent(
      `Hola ${order.clientName}! Te enviamos el presupuesto N° ${noPresup} para tu ${order.brand} ${order.model}.\n` +
      `Total: ${fmt(total)}\n` +
      `Para confirmar o consultas llamanos al 11 5900-0486 / 11 2181-6064.\n` +
      `*MAQJEEZ — Soluciones en Maquinaria*`
    );
    const phone = order.clientPhone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  };

  const retiroDeadline = () => {
    const d = new Date(notifDate);
    d.setDate(d.getDate() + 90);
    return d.toLocaleDateString("es-AR");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col overflow-y-auto">
      {/* ── Controles (no se imprimen) ── */}
      <div className="no-print sticky top-0 z-10 bg-gray-900 border-b border-gray-700 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-orange-400" />
            <span className="text-white font-bold">Generar Presupuesto PNG</span>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm p-2 rounded-xl"><X className="w-5 h-5" /></button>
        </div>

        {/* Parámetros */}
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="text-gray-400 text-xs block mb-1">N° Presupuesto</label>
            <input className="input input-sm w-32 font-mono" value={noPresup} onChange={e => setNoPresup(e.target.value)} />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Fecha de aviso al cliente</label>
            <input type="date" className="input input-sm w-44" value={notifDate}
              onChange={e => setNotifDate(e.target.value)} />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1">Descuento</label>
            <div className="flex gap-1">
              <select className="input input-sm w-14" value={discType} onChange={e => setDiscType(e.target.value as "$" | "%")}>
                <option value="$">$</option>
                <option value="%">%</option>
              </select>
              <input type="number" className="input input-sm w-24" min={0} value={discount}
                onChange={e => setDiscount(Number(e.target.value) || 0)} />
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap gap-2">
          <button onClick={generate} disabled={generating}
            className="btn-primary btn-sm rounded-xl flex-1 sm:flex-none">
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</>
              : <><ImageIcon className="w-4 h-4" /> Generar imagen</>}
          </button>
          {imageUrl && <>
            <button onClick={download} className="btn-secondary btn-sm rounded-xl flex-1 sm:flex-none">
              <Download className="w-4 h-4 text-blue-400" /> Descargar PNG
            </button>
            <button onClick={sendWhatsApp} className="btn-sm rounded-xl flex-1 sm:flex-none bg-green-600 text-white hover:bg-green-700 btn">
              <MessageCircle className="w-4 h-4" /> Enviar WA
            </button>
          </>}
          <button onClick={() => window.print()} className="btn-secondary btn-sm rounded-xl">
            <Printer className="w-4 h-4 text-gray-400" /> Imprimir
          </button>
        </div>

        {/* Items editables */}
        <div className="space-y-2">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Ítems del presupuesto</p>
          {items.map((it, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input className="input input-sm flex-1" placeholder="Descripción"
                value={it.desc} onChange={e => upd(i, "desc", e.target.value)} />
              <input type="number" className="input input-sm w-16" placeholder="Cant"
                value={it.qty} onChange={e => upd(i, "qty", e.target.value)} />
              <input type="number" className="input input-sm w-28" placeholder="Precio"
                value={it.unitPrice} onChange={e => upd(i, "unitPrice", e.target.value)} />
              <button onClick={() => removeItem(i)} className="text-gray-500 hover:text-red-400 p-2">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button onClick={addItem} className="text-orange-400 text-xs font-semibold flex items-center gap-1 hover:text-orange-300">
            <Plus className="w-3.5 h-3.5" /> Agregar ítem
          </button>
        </div>

        {imageUrl && (
          <p className="text-green-400 text-xs font-semibold">
            ✓ Imagen lista — descargala o enviala por WhatsApp
          </p>
        )}
      </div>

      {/* ══════════ DISEÑO DEL PRESUPUESTO (se convierte a imagen) ══════════ */}
      <div className="flex justify-center py-6 print:py-0">
        <div
          ref={ref}
          className="bg-white text-gray-900 font-sans"
          style={{ width: 794, minHeight: 1100, padding: "0 0 32px 0", borderRadius: 0 }}
        >
          {/* ── Header ── */}
          <div style={{ background: "linear-gradient(135deg,#1a3a5c 0%,#0f2540 100%)", padding: "28px 36px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-maqjeez.png" alt="MAQJEEZ" style={{ height: 72, width: "auto", objectFit: "contain" }} />
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#6b9ac4", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>
                  Presupuesto
                </div>
                <div style={{ color: "#f97316", fontWeight: 900, fontSize: 28, letterSpacing: 1 }}>
                  N° {noPresup}
                </div>
                <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                  {formatDate(new Date().toISOString())}
                </div>
              </div>
            </div>
          </div>

          {/* ── Datos empresa / cliente ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "2px solid #e2e8f0" }}>
            {/* Empresa */}
            <div style={{ padding: "20px 24px", borderRight: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#1a3a5c", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>
                Datos de la Empresa
              </div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#1a3a5c", marginBottom: 4 }}>{EMPRESA.nombre}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{EMPRESA.slogan}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>CUIT: {EMPRESA.cuit}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{EMPRESA.dir}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{EMPRESA.loc}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Tel: {EMPRESA.tel}</div>
            </div>
            {/* Cliente */}
            <div style={{ padding: "20px 24px" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#1a3a5c", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>
                Datos del Cliente
              </div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#1a3a5c", marginBottom: 4 }}>{order.clientName}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Tel: {order.clientPhone}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>
                <strong>Equipo:</strong> {order.brand} {order.model} — Tipo: {MOTOR_TYPE_LABELS[order.motorType] ?? order.motorType}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2, lineHeight: 1.5 }}>
                <strong>Falla reportada:</strong> {order.reportedIssues}
              </div>
              {order.internalNotes && (
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
                  <strong>Detalle técnico:</strong> {order.internalNotes}
                </div>
              )}
            </div>
          </div>

          {/* ── Tabla ── */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 0 }}>
            <thead>
              <tr style={{ background: "#1a3a5c", color: "#ffffff" }}>
                <th style={{ textAlign: "left",  padding: "10px 24px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, width: "52%" }}>Descripción</th>
                <th style={{ textAlign: "center", padding: "10px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, width: "10%" }}>Cant.</th>
                <th style={{ textAlign: "right",  padding: "10px 16px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, width: "19%" }}>Precio Unit.</th>
                <th style={{ textAlign: "right",  padding: "10px 24px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, width: "19%" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "11px 24px", fontSize: 13 }}>{it.desc}</td>
                  <td style={{ padding: "11px 12px", fontSize: 13, textAlign: "center" }}>{it.qty}</td>
                  <td style={{ padding: "11px 16px", fontSize: 13, textAlign: "right" }}>{fmt(it.unitPrice)}</td>
                  <td style={{ padding: "11px 24px", fontSize: 13, fontWeight: 600, textAlign: "right" }}>{fmt(it.qty * it.unitPrice)}</td>
                </tr>
              ))}
              {[...Array(Math.max(0, 5 - items.length))].map((_, i) => (
                <tr key={"e" + i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "14px 24px" }}>&nbsp;</td>
                  <td /><td /><td />
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Totales ── */}
          <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "2px solid #1a3a5c", marginTop: 0 }}>
            <div style={{ width: 280 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 24px", borderBottom: "1px solid #e2e8f0" }}>
                <span style={{ color: "#64748b", fontSize: 13 }}>Subtotal</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{fmt(subtotal)}</span>
              </div>
              {descAmt > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 24px", borderBottom: "1px solid #e2e8f0" }}>
                  <span style={{ color: "#64748b", fontSize: 13 }}>Descuento {discType === "%" ? `(${discount}%)` : ""}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "#16a34a" }}>- {fmt(descAmt)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 24px", background: "#1a3a5c" }}>
                <span style={{ color: "#ffffff", fontWeight: 800, fontSize: 14, textTransform: "uppercase", letterSpacing: 1 }}>TOTAL</span>
                <span style={{ color: "#f97316", fontWeight: 900, fontSize: 18 }}>{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* ── Aviso de retiro ── */}
          <div style={{ background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 8, margin: "20px 24px 8px", padding: "12px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#b45309", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              ⚠ Fecha de Aviso al Cliente: {new Date(notifDate + "T12:00:00").toLocaleDateString("es-AR")} — Retiro antes del: {retiroDeadline()}
            </div>
            <div style={{ fontSize: 10.5, color: "#78350f", lineHeight: 1.6 }}>{CLAUSULA_90}</div>
          </div>

          {/* ── Política de diagnóstico ── */}
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, margin: "8px 24px", padding: "12px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#15803d", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              💡 Política de Diagnóstico
            </div>
            <div style={{ fontSize: 10.5, color: "#166534", lineHeight: 1.6 }}>{CLAUSULA_DIAG}</div>
          </div>

          {/* ── Firmas ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, padding: "24px 36px 0", marginTop: 16 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ borderBottom: "2px solid #1a3a5c", height: 48, marginBottom: 8 }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1a3a5c" }}>MAQJEEZ</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Firma y sello del taller</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ borderBottom: "2px solid #1a3a5c", height: 48, marginBottom: 8 }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1a3a5c" }}>{order.clientName}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Firma del cliente — Conforme</div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div style={{ textAlign: "center", marginTop: 20, padding: "12px 24px", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              {EMPRESA.nombre} · CUIT {EMPRESA.cuit} · {EMPRESA.dir} · {EMPRESA.loc} · Tel: {EMPRESA.tel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
