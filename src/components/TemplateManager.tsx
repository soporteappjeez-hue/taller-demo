"use client";

import { useState, useEffect } from "react";
import { PlantillaWhatsApp } from "@/lib/types";
import { plantillasDb } from "@/lib/db";
import { generateId } from "@/lib/utils";
import { X, MessageCircle, Plus, Trash2, Edit2, Copy, Check } from "lucide-react";

interface Props { onClose: () => void; }

const VARIABLES = [
  { label: "Nombre cliente", value: "{{nombre}}" },
  { label: "Marca", value: "{{marca}}" },
  { label: "Modelo", value: "{{modelo}}" },
  { label: "Motor", value: "{{motor}}" },
  { label: "Estado", value: "{{estado}}" },
];

const DEFAULT_TEMPLATES: Omit<PlantillaWhatsApp, "id" | "createdAt">[] = [
  {
    name: "Presupuesto listo",
    message: "Hola {{nombre}}, te informamos que el presupuesto para tu {{marca}} {{modelo}} ({{motor}}) está listo. Por favor comunicate con nosotros para confirmarlo. ¡Gracias por confiar en MAQJEEZ!",
  },
  {
    name: "Equipo listo para retiro",
    message: "Hola {{nombre}}, tu {{marca}} {{modelo}} ({{motor}}) ya está lista para ser retirada. Te esperamos en el taller. ¡Gracias!",
  },
  {
    name: "Recordatorio de retiro",
    message: "Hola {{nombre}}, te recordamos que tu {{marca}} {{modelo}} ({{motor}}) sigue esperando ser retirada en el taller MAQJEEZ. Comunicate con nosotros para coordinar la entrega.",
  },
];

export default function TemplateManager({ onClose }: Props) {
  const [templates, setTemplates] = useState<PlantillaWhatsApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await plantillasDb.getAll();
      setTemplates(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!name.trim() || !message.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await plantillasDb.update(editingId, { name: name.trim(), message: message.trim() });
      } else {
        await plantillasDb.create({
          id: generateId(),
          name: name.trim(),
          message: message.trim(),
          createdAt: new Date().toISOString(),
        });
      }
      setName(""); setMessage(""); setEditingId(null);
      await load();
    } catch (e) { alert("Error: " + e); }
    setSaving(false);
  };

  const handleEdit = (t: PlantillaWhatsApp) => {
    setEditingId(t.id);
    setName(t.name);
    setMessage(t.message);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta plantilla?")) return;
    await plantillasDb.delete(id);
    await load();
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const insertVariable = (v: string) => {
    setMessage((prev) => prev + v);
  };

  const seedDefaults = async () => {
    if (!confirm("¿Cargar plantillas de ejemplo?")) return;
    setSaving(true);
    for (const t of DEFAULT_TEMPLATES) {
      await plantillasDb.create({ id: generateId(), ...t, createdAt: new Date().toISOString() });
    }
    await load();
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-gray-900 w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl border border-gray-700 shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="bg-green-600 rounded-xl p-2"><MessageCircle className="w-5 h-5 text-white" /></div>
            <div>
              <h2 className="text-white font-bold">Plantillas de WhatsApp</h2>
              <p className="text-gray-400 text-xs">Mensajes reutilizables con variables</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm p-2.5 rounded-xl"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Editor */}
          <div className="card space-y-3">
            <p className="text-white font-bold text-sm">{editingId ? "Editar plantilla" : "Nueva plantilla"}</p>
            <input
              type="text" className="input input-sm" placeholder="Nombre de la plantilla"
              value={name} onChange={(e) => setName(e.target.value)}
            />
            <textarea
              className="input input-sm resize-none" rows={4}
              placeholder="Escribe el mensaje... usa las variables de abajo"
              value={message} onChange={(e) => setMessage(e.target.value)}
            />
            {/* Variables */}
            <div className="flex flex-wrap gap-2">
              {VARIABLES.map((v) => (
                <button key={v.value} onClick={() => insertVariable(v.value)}
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-orange-300 px-2.5 py-1 rounded-lg font-mono transition-colors">
                  {v.value}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">Las variables se reemplazan automáticamente al enviar desde una orden.</p>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving || !name || !message} className="btn-primary flex-1 btn-sm">
                <Plus className="w-4 h-4" /> {editingId ? "Guardar cambios" : "Crear plantilla"}
              </button>
              {editingId && (
                <button onClick={() => { setEditingId(null); setName(""); setMessage(""); }}
                  className="btn-secondary btn-sm px-4">Cancelar</button>
              )}
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-7 h-7 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-gray-400">No hay plantillas todavía</p>
              <button onClick={seedDefaults} disabled={saving} className="btn-secondary btn-sm">
                Cargar plantillas de ejemplo
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold">{templates.length} plantilla{templates.length !== 1 ? "s" : ""}</p>
              {templates.map((t) => (
                <div key={t.id} className="card space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-white font-bold text-sm">{t.name}</p>
                    <div className="flex gap-1">
                      <button onClick={() => handleCopy(t.message, t.id)}
                        className="p-2 rounded-lg text-gray-400 hover:text-orange-400 hover:bg-gray-700 transition-colors" title="Copiar mensaje">
                        {copied === t.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleEdit(t)}
                        className="p-2 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-gray-700 transition-colors" title="Editar">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(t.id)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">{t.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
