"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Camera, X, Loader2, ImagePlus } from "lucide-react";

interface Props {
  urls: string[];
  onChange: (urls: string[]) => void;
  maxPhotos?: number;
}

async function compressImage(file: File, maxWidth = 1280, quality = 0.78): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", quality);
    };
    img.src = url;
  });
}

export default function PhotoUpload({ urls, onChange, maxPhotos = 5 }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = maxPhotos - urls.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];

    for (let i = 0; i < toUpload.length; i++) {
      setUploadingIdx(i + 1);
      const file = toUpload[i];
      try {
        const compressed = await compressImage(file);
        const ext = "jpg";
        const path = `orders/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage
          .from("fotos-maquinas")
          .upload(path, compressed, { contentType: "image/jpeg", upsert: false });
        if (error) {
          console.error("[PhotoUpload] Error Supabase Storage:", error.message, error);
          throw new Error(error.message);
        }
        const { data } = supabase.storage.from("fotos-maquinas").getPublicUrl(path);
        newUrls.push(data.publicUrl);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        alert(`Error al subir foto ${i + 1}: ${msg}\n\nAsegurate de que el bucket "fotos-maquinas" existe y es público en Supabase Storage.`);
      }
    }

    onChange([...urls, ...newUrls]);
    setUploading(false);
    setUploadingIdx(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (idx: number) => {
    onChange(urls.filter((_, i) => i !== idx));
  };

  const canAdd = urls.length < maxPhotos && !uploading;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {urls.map((url, i) => (
          <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-800 border border-gray-700">
            <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-lg p-1
                         opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
            <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-md">
              {i + 1}
            </span>
          </div>
        ))}

        {/* Botón agregar */}
        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-gray-600
                       hover:border-orange-500 hover:bg-orange-500/10 transition-colors
                       flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-orange-400"
          >
            <ImagePlus className="w-6 h-6" />
            <span className="text-xs font-semibold">Añadir</span>
          </button>
        )}

        {/* Estado cargando */}
        {uploading && (
          <div className="aspect-square rounded-xl border border-gray-700 bg-gray-800
                          flex flex-col items-center justify-center gap-1 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
            <span className="text-xs">{uploadingIdx}/{maxPhotos - urls.length + (uploadingIdx ?? 1) - 1}</span>
          </div>
        )}
      </div>

      {/* Input oculto — acepta cámara en móvil */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {urls.length}/{maxPhotos} fotos · Se comprimen automáticamente antes de subir
        </p>
        {urls.length === 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="btn-secondary btn-sm rounded-xl flex items-center gap-2"
          >
            <Camera className="w-4 h-4 text-orange-400" />
            Abrir Cámara
          </button>
        )}
      </div>
    </div>
  );
}
