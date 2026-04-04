"use client";

import { useState } from "react";
import { WorkOrder } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { X, Camera, Link, Trash2, Plus, Loader2 } from "lucide-react";

interface Props {
  order: WorkOrder;
  onClose: () => void;
  onUpdated: (urls: string[]) => void;
}

export default function PhotoManager({ order, onClose, onUpdated }: Props) {
  const [photos, setPhotos] = useState<string[]>(order.photoUrls ?? []);
  const [newUrl, setNewUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = () => {
    const url = newUrl.trim();
    if (!url) return;
    const updated = [...photos, url];
    setPhotos(updated);
    setNewUrl("");
  };

  const handleRemove = (idx: number) => {
    const updated = photos.filter((_, i) => i !== idx);
    setPhotos(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("reparaciones")
        .update({ photo_urls: photos })
        .eq("id", order.id);
      if (error) throw error;
      onUpdated(photos);
      onClose();
    } catch (e) {
      alert("Error al guardar fotos: " + e);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-gray-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl border border-gray-700 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 rounded-xl p-2"><Camera className="w-5 h-5 text-white" /></div>
            <div>
              <h2 className="text-white font-bold">Fotos del Equipo</h2>
              <p className="text-gray-400 text-xs">{order.clientName} · {order.brand} {order.model}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm p-2.5 rounded-xl"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Add URL */}
          <div className="card space-y-3">
            <p className="text-sm font-bold text-white flex items-center gap-2">
              <Link className="w-4 h-4 text-gray-400" /> Agregar foto por URL
            </p>
            <div className="flex gap-2">
              <input
                type="url" className="input input-sm flex-1"
                placeholder="https://..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <button onClick={handleAdd} className="btn-primary btn-sm px-4 rounded-xl">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Sube la foto a Google Drive, Imgur, o cualquier servicio y pega el enlace directo aquí.
            </p>
          </div>

          {/* Gallery */}
          {photos.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-gray-500">
              <Camera className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">No hay fotos todavía</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {photos.map((url, i) => (
                <div key={i} className="relative group rounded-xl overflow-hidden bg-gray-800 border border-gray-700">
                  <img
                    src={url}
                    alt={`Foto ${i + 1}`}
                    className="w-full h-36 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='144' viewBox='0 0 200 144'%3E%3Crect width='200' height='144' fill='%231f2937'/%3E%3Ctext x='100' y='72' text-anchor='middle' fill='%236b7280' font-size='12'%3EError al cargar%3C/text%3E%3C/svg%3E";
                    }}
                  />
                  <button
                    onClick={() => handleRemove(i)}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <p className="text-xs text-gray-500 px-2 py-1.5 truncate">{i + 1}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-700">
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            Guardar fotos ({photos.length})
          </button>
        </div>
      </div>
    </div>
  );
}
