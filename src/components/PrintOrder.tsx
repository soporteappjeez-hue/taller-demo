"use client";

import { useState } from "react";
import { WorkOrder, MOTOR_TYPE_LABELS } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Printer, X, Plus, Trash2 } from "lucide-react";

interface Props { order: WorkOrder; onClose: () => void; }

interface LineItem { desc: string; qty: number; price: number; }

const EMPRESA = {
  nombre: "MAQJEEZ",
  razon:  "Servicio Técnico de Moto-Implementos y Motovehículos",
  cuit:   "20-31264840-8",
  dir:    "Constancio Vigil 150, Carlos Spegazzini",
  loc:    "Partido de Ezeiza, Bs. As.",
  tel:    "11 5900-0486 / 11 2181-6064",
};

function fmt(n: number) {
  return "$\u00a0" + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PrintOrder({ order, onClose }: Props) {
  const defaultItem: LineItem = {
    desc:  order.reportedIssues || "Servicio de reparación",
    qty:   1,
    price: order.budget ?? 0,
  };

  const [items, setItems]             = useState<LineItem[]>([defaultItem]);
  const [validez, setValidez]         = useState("15");
  const [descType, setDescType]       = useState<"$" | "%">("$");
  const [descValue, setDescValue]     = useState(0);
  const [noPresup, setNoPresup]       = useState(order.id.slice(0, 8).toUpperCase());

  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const descAmount = descType === "$" ? descValue : Math.round(subtotal * descValue / 100);
  const total = subtotal - descAmount;

  const addItem = () => setItems([...items, { desc: "", qty: 1, price: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof LineItem, val: string) => {
    setItems(items.map((item, idx) =>
      idx === i
        ? { ...item, [field]: field === "desc" ? val : Number(val) || 0 }
        : item
    ));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col overflow-y-auto">
      {/* Controles — ocultos al imprimir */}
      <div className="no-print sticky top-0 z-10 bg-gray-900 border-b border-gray-700 px-4 py-3 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-3 flex-1">
          <div>
            <label className="text-gray-400 text-xs block mb-0.5">N° Presupuesto</label>
            <input className="input input-sm w-32 font-mono" value={noPresup}
              onChange={e => setNoPresup(e.target.value)} />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-0.5">Validez (días)</label>
            <input type="number" className="input input-sm w-20" value={validez}
              onChange={e => setValidez(e.target.value)} />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-0.5">Descuento</label>
            <div className="flex gap-1">
              <select className="input input-sm w-14"
                value={descType} onChange={e => setDescType(e.target.value as "$" | "%")}>
                <option value="$">$</option>
                <option value="%">%</option>
              </select>
              <input type="number" className="input input-sm w-24" min={0} value={descValue}
                onChange={e => setDescValue(Number(e.target.value) || 0)} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()}
            className="btn-primary btn-sm rounded-xl">
            <Printer className="w-4 h-4" /> Imprimir / PDF
          </button>
          <button onClick={onClose}
            className="btn-secondary btn-sm rounded-xl">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ══════════ PRESUPUESTO IMPRIMIBLE ══════════ */}
      <div id="presupuesto"
        className="bg-white text-gray-900 w-full max-w-2xl mx-auto my-6 print:my-0
                   shadow-2xl print:shadow-none rounded-2xl print:rounded-none
                   font-sans text-sm overflow-hidden">

        {/* ── Encabezado ── */}
        <div className="bg-[#1a3a5c] text-white px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-2xl font-black tracking-tight text-orange-400">{EMPRESA.nombre}</p>
            <p className="text-xs text-blue-200 mt-0.5">{EMPRESA.razon}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-blue-300 uppercase tracking-wide">Presupuesto</p>
            <p className="font-black text-xl text-orange-300">N° {noPresup}</p>
          </div>
        </div>

        {/* ── Datos empresa / cliente ── */}
        <div className="grid grid-cols-2 border-b border-gray-200">
          <div className="px-5 py-4 border-r border-gray-200 space-y-1">
            <p className="text-xs font-black uppercase tracking-widest text-[#1a3a5c] mb-2">
              Datos de la Empresa
            </p>
            <p className="font-bold">{EMPRESA.nombre}</p>
            <p className="text-gray-600 text-xs">CUIT: {EMPRESA.cuit}</p>
            <p className="text-gray-600 text-xs">{EMPRESA.dir}</p>
            <p className="text-gray-600 text-xs">{EMPRESA.loc}</p>
            <p className="text-gray-600 text-xs">Tel: {EMPRESA.tel}</p>
          </div>
          <div className="px-5 py-4 space-y-1">
            <p className="text-xs font-black uppercase tracking-widest text-[#1a3a5c] mb-2">
              Datos del Cliente
            </p>
            <p className="font-bold">{order.clientName}</p>
            <p className="text-gray-600 text-xs">Tel: {order.clientPhone}</p>
            <p className="text-gray-600 text-xs">
              <span className="font-semibold">Equipo:</span> {order.brand} {order.model}
              {" "}{MOTOR_TYPE_LABELS[order.motorType] ?? order.motorType}
            </p>
            <p className="text-gray-600 text-xs leading-snug">
              <span className="font-semibold">Falla:</span> {order.reportedIssues}
            </p>
          </div>
        </div>

        {/* ── Fecha y validez ── */}
        <div className="flex items-center gap-6 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs">
          <span>
            <span className="font-bold text-gray-500 uppercase tracking-wide mr-1">Fecha:</span>
            <span className="font-semibold">{formatDate(new Date().toISOString())}</span>
          </span>
          <span>
            <span className="font-bold text-gray-500 uppercase tracking-wide mr-1">Ingreso:</span>
            <span className="font-semibold">{formatDate(order.entryDate)}</span>
          </span>
          <span>
            <span className="font-bold text-gray-500 uppercase tracking-wide mr-1">Validez:</span>
            <span className="font-semibold">{validez} días</span>
          </span>
        </div>

        {/* ── Tabla de ítems ── */}
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#1a3a5c] text-white text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-2.5 font-bold w-[50%]">Descripción</th>
              <th className="text-center px-3 py-2.5 font-bold w-[12%]">Uds.</th>
              <th className="text-right px-3 py-2.5 font-bold w-[19%]">Precio Unit.</th>
              <th className="text-right px-4 py-2.5 font-bold w-[19%]">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}`}>
                {/* Descripción */}
                <td className="px-4 py-2.5">
                  <input
                    className="no-print w-full border-b border-dashed border-gray-300 bg-transparent
                               focus:outline-none focus:border-orange-400 text-sm"
                    value={item.desc}
                    placeholder="Descripción del trabajo..."
                    onChange={e => updateItem(i, "desc", e.target.value)}
                  />
                  <span className="only-print">{item.desc}</span>
                </td>
                {/* Cantidad */}
                <td className="px-3 py-2.5 text-center">
                  <input type="number" min={1}
                    className="no-print w-14 text-center border-b border-dashed border-gray-300
                               bg-transparent focus:outline-none focus:border-orange-400 text-sm"
                    value={item.qty}
                    onChange={e => updateItem(i, "qty", e.target.value)}
                  />
                  <span className="only-print">{item.qty}</span>
                </td>
                {/* Precio */}
                <td className="px-3 py-2.5 text-right">
                  <input type="number" min={0}
                    className="no-print w-24 text-right border-b border-dashed border-gray-300
                               bg-transparent focus:outline-none focus:border-orange-400 text-sm"
                    value={item.price}
                    onChange={e => updateItem(i, "price", e.target.value)}
                  />
                  <span className="only-print">{fmt(item.price)}</span>
                </td>
                {/* Total fila */}
                <td className="px-4 py-2.5 text-right font-semibold">
                  {fmt(item.qty * item.price)}
                  <button
                    onClick={() => removeItem(i)}
                    className="no-print ml-2 text-gray-300 hover:text-red-400 transition-colors"
                    title="Eliminar fila"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {/* Botón agregar fila — solo en pantalla */}
            <tr className="no-print">
              <td colSpan={4} className="px-4 py-2">
                <button onClick={addItem}
                  className="text-xs text-orange-500 hover:text-orange-400 font-semibold
                             flex items-center gap-1 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Agregar ítem
                </button>
              </td>
            </tr>
            {/* Filas vacías para impresión */}
            {[...Array(Math.max(0, 5 - items.length))].map((_, i) => (
              <tr key={"empty" + i} className="only-print border-b border-gray-100">
                <td className="px-4 py-3">&nbsp;</td>
                <td /><td /><td />
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Totales ── */}
        <div className="flex justify-end border-t-2 border-[#1a3a5c] mt-1">
          <div className="w-64 divide-y divide-gray-100">
            <div className="flex justify-between px-4 py-2">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-semibold">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between px-4 py-2">
              <span className="text-gray-500">
                Descuento {descType === "%" ? `(${descValue}%)` : ""}
              </span>
              <span className={`font-semibold ${descAmount > 0 ? "text-green-600" : "text-gray-400"}`}>
                {descAmount > 0 ? "- " + fmt(descAmount) : fmt(0)}
              </span>
            </div>
            <div className="flex justify-between px-4 py-3 bg-[#1a3a5c] text-white">
              <span className="font-black uppercase tracking-wide text-sm">Total Presupuesto</span>
              <span className="font-black text-orange-300 text-base">{fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* ── Notas / condiciones ── */}
        <div className="px-5 py-4 text-xs text-gray-500 border-t border-gray-200 space-y-1">
          <p className="font-semibold text-gray-600">Condiciones:</p>
          <p>• El presupuesto tiene una validez de {validez} días desde su emisión.</p>
          <p>• Los repuestos no incluidos en este presupuesto serán cotizados por separado.</p>
          <p>• Una vez aceptado el presupuesto, no se realizarán cambios sin previo aviso.</p>
        </div>

        {/* ── Firmas ── */}
        <div className="grid grid-cols-2 gap-8 px-8 py-6 border-t border-gray-200">
          <div className="text-center">
            <div className="border-b-2 border-[#1a3a5c] mb-2 h-12" />
            <p className="text-xs text-gray-500 font-semibold">{EMPRESA.nombre}</p>
            <p className="text-xs text-gray-400">Firma y sello del taller</p>
          </div>
          <div className="text-center">
            <div className="border-b-2 border-[#1a3a5c] mb-2 h-12" />
            <p className="text-xs text-gray-500 font-semibold">{order.clientName}</p>
            <p className="text-xs text-gray-400">Firma del cliente — Conforme</p>
          </div>
        </div>

        <div className="text-center text-xs text-gray-400 py-3 bg-gray-50 border-t border-gray-100">
          {EMPRESA.nombre} · CUIT {EMPRESA.cuit} · Tel {EMPRESA.tel}
        </div>
      </div>
    </div>
  );
}
