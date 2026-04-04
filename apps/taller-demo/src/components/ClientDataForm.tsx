"use client";

import { useState, useEffect } from "react";
import { User, FileText, MapPin } from "lucide-react";

interface ClientData {
  nombre?: string;
  dni?: string;
  direccion?: string;
  telefono?: string;
}

interface Props {
  initialData?: ClientData;
  onClientDataChange: (data: ClientData) => void;
}

export default function ClientDataForm({ initialData = {}, onClientDataChange }: Props) {
  const [nombre, setNombre] = useState(initialData.nombre || "");
  const [dni, setDni] = useState(initialData.dni || "");
  const [direccion, setDireccion] = useState(initialData.direccion || "");
  const [telefono, setTelefono] = useState(initialData.telefono || "");

  useEffect(() => {
    onClientDataChange({ nombre, dni, direccion, telefono });
  }, [nombre, dni, direccion, telefono, onClientDataChange]);

  const handleReset = () => {
    setNombre("");
    setDni("");
    setDireccion("");
    setTelefono("");
  };

  const isEmpty = !nombre && !dni && !direccion && !telefono;

  return (
    <div className="card border border-white/10 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <User className="w-4 h-4" style={{ color: "#00E5FF" }} />
          Datos del Cliente (Opcional)
        </h3>
        {!isEmpty && (
          <button
            onClick={handleReset}
            className="text-xs px-2 py-1 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-white/10 transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Status badge */}
      <div className="mb-3">
        {isEmpty ? (
          <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "#6B728015", color: "#6B7280" }}>
            Consumidor Final
          </span>
        ) : (
          <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "#39FF1415", color: "#39FF14" }}>
            ✓ Datos cargados
          </span>
        )}
      </div>

      {/* Inputs grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        {/* Nombre */}
        <div>
          <label className="text-xs text-gray-500 font-semibold mb-1 flex items-center gap-1">
            <User className="w-3 h-3" /> Nombre
          </label>
          <input
            type="text"
            placeholder="Ej: Juan García"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="input input-sm w-full"
          />
        </div>

        {/* DNI/CUIT */}
        <div>
          <label className="text-xs text-gray-500 font-semibold mb-1 flex items-center gap-1">
            <FileText className="w-3 h-3" /> DNI/CUIT
          </label>
          <input
            type="text"
            placeholder="Ej: 12345678 o 20-12345678-5"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            className="input input-sm w-full"
          />
        </div>

        {/* Dirección */}
        <div>
          <label className="text-xs text-gray-500 font-semibold mb-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Dirección
          </label>
          <input
            type="text"
            placeholder="Ej: Av. Siempreviva 123"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className="input input-sm w-full"
          />
        </div>

        {/* Teléfono */}
        <div>
          <label className="text-xs text-gray-500 font-semibold mb-1 flex items-center gap-1">
            📱 Teléfono
          </label>
          <input
            type="tel"
            placeholder="Ej: 1123456789"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="input input-sm w-full"
          />
        </div>
      </div>
    </div>
  );
}
