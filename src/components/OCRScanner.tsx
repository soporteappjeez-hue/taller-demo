"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FlexZona, FLEX_LOCALIDADES } from "@/lib/types";
import {
  X, Camera, Search, ChevronRight, AlertTriangle,
  CheckCircle2, Loader2, Save, DollarSign, TrendingUp, Package,
} from "lucide-react";

const MAX = 50;

const ZONA_COLORS: Record<FlexZona, string> = {
  cercana: "bg-green-500/20 text-green-300 border-green-500/40",
  media:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  lejana:  "bg-red-500/20 text-red-300 border-red-500/40",
};
const ZONA_LABELS: Record<FlexZona, string> = { cercana: "Cercana", media: "Media", lejana: "Lejana" };
const fmt = (n: number) => "$" + n.toLocaleString("es-AR");

function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 1100;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
  } catch (_) {}
}

// ─── Mapa de códigos postales a localidades ─────────────────────────────────
const CP_MAP: Record<string, string> = {
  // Ezeiza (Cercana)
  "1802": "Ezeiza", "1741": "Ezeiza", "1742": "Ezeiza", "1743": "Ezeiza",
  // Esteban Echeverría (Media)
  "1842": "Esteban Echeverría", "1843": "Esteban Echeverría",
  "1844": "Esteban Echeverría", "1845": "Esteban Echeverría",
  "1846": "Esteban Echeverría",
  // La Matanza Sur (Media)
  "1754": "La Matanza Sur", "1755": "La Matanza Sur", "1756": "La Matanza Sur",
  "1757": "La Matanza Sur", "1758": "La Matanza Sur", "1759": "La Matanza Sur",
  // Florencio Varela (Lejana)
  "1887": "Florencio Varela", "1888": "Florencio Varela", "1889": "Florencio Varela",
  // Berisso (Lejana)
  "1923": "Berisso",
  // Campana (Lejana)
  "2804": "Campana",
  // Cañuelas (Lejana)
  "1814": "Cañuelas",
  // Del Viso (Lejana)
  "1669": "Del Viso",
  // Derqui (Lejana)
  "1631": "Derqui",
  // Ensenada (Lejana)
  "1925": "Ensenada",
  // Escobar (Lejana)
  "1625": "Escobar", "1626": "Escobar", "1627": "Escobar", "1628": "Escobar",
  // Gral. Rodríguez (Lejana)
  "1748": "Gral. Rodríguez",
  // Guernica (Lejana)
  "1862": "Guernica",
  // Ing. Maschwitz (Lejana)
  "1623": "Ing. Maschwitz", "1624": "Ing. Maschwitz",
  // La Plata (Lejana)
  "1900": "La Plata Centro", "1901": "La Plata Centro", "1902": "La Plata Centro",
  "1903": "La Plata Norte", "1904": "La Plata Norte", "1905": "La Plata Norte",
  "1906": "La Plata Oeste", "1907": "La Plata Oeste",
  // Luján (Lejana)
  "6700": "Luján",
  // Marcos Paz (Lejana)
  "1721": "Marcos Paz", "1722": "Marcos Paz",
  // Nordelta (Lejana)
  "1670": "Nordelta",
  // Pilar (Lejana)
  "1629": "Pilar", "1630": "Pilar", "1632": "Pilar", "1633": "Pilar",
  "1634": "Pilar", "1635": "Pilar",
  // San Vicente (Lejana)
  "1861": "San Vicente",
  // Villa Rosa (Lejana)
  "1636": "Villa Rosa",
  // Zárate (Lejana)
  "2800": "Zárate",
  // Garín (Lejana)
  "1619": "Garín",
  // Alte. Brown (Lejana)
  "1840": "Alte. Brown", "1841": "Alte. Brown",
  "1847": "Alte. Brown", "1849": "Alte. Brown", "1850": "Alte. Brown", "1851": "Alte. Brown",
  // Avellaneda (Lejana)
  "1870": "Avellaneda", "1871": "Avellaneda", "1872": "Avellaneda",
  // Berazategui (Lejana)
  "1880": "Berazategui", "1881": "Berazategui", "1882": "Berazategui",
  // CABA (Lejana) — rangos comunes
  "1001": "CABA", "1002": "CABA", "1003": "CABA", "1004": "CABA",
  "1005": "CABA", "1006": "CABA", "1007": "CABA", "1008": "CABA",
  "1009": "CABA", "1010": "CABA", "1011": "CABA", "1012": "CABA",
  "1013": "CABA", "1014": "CABA", "1015": "CABA", "1020": "CABA",
  "1025": "CABA", "1030": "CABA", "1035": "CABA", "1040": "CABA",
  "1043": "CABA", "1045": "CABA", "1048": "CABA", "1050": "CABA",
  "1053": "CABA", "1055": "CABA", "1057": "CABA", "1059": "CABA",
  "1063": "CABA", "1065": "CABA", "1068": "CABA", "1069": "CABA",
  "1070": "CABA", "1072": "CABA", "1074": "CABA", "1076": "CABA",
  "1082": "CABA", "1083": "CABA", "1084": "CABA", "1086": "CABA",
  "1087": "CABA", "1088": "CABA", "1090": "CABA", "1091": "CABA",
  "1092": "CABA", "1093": "CABA", "1094": "CABA", "1096": "CABA",
  "1098": "CABA", "1100": "CABA", "1101": "CABA", "1102": "CABA",
  "1103": "CABA", "1104": "CABA", "1105": "CABA", "1107": "CABA",
  "1109": "CABA", "1111": "CABA", "1113": "CABA", "1114": "CABA",
  "1115": "CABA", "1116": "CABA", "1117": "CABA", "1118": "CABA",
  "1119": "CABA", "1120": "CABA", "1121": "CABA", "1122": "CABA",
  "1124": "CABA", "1125": "CABA", "1126": "CABA", "1128": "CABA",
  "1130": "CABA", "1131": "CABA", "1132": "CABA", "1133": "CABA",
  "1135": "CABA", "1136": "CABA", "1137": "CABA", "1138": "CABA",
  "1139": "CABA", "1140": "CABA", "1141": "CABA", "1142": "CABA",
  "1143": "CABA", "1144": "CABA", "1145": "CABA", "1147": "CABA",
  "1148": "CABA", "1149": "CABA", "1150": "CABA", "1151": "CABA",
  "1152": "CABA", "1153": "CABA", "1154": "CABA", "1155": "CABA",
  "1156": "CABA", "1157": "CABA", "1158": "CABA", "1159": "CABA",
  "1160": "CABA", "1161": "CABA", "1162": "CABA", "1163": "CABA",
  "1164": "CABA", "1165": "CABA", "1166": "CABA", "1169": "CABA",
  "1170": "CABA", "1171": "CABA", "1172": "CABA", "1173": "CABA",
  "1174": "CABA", "1175": "CABA", "1176": "CABA", "1177": "CABA",
  "1178": "CABA", "1179": "CABA", "1180": "CABA", "1181": "CABA",
  "1182": "CABA", "1183": "CABA", "1184": "CABA", "1185": "CABA",
  "1186": "CABA", "1187": "CABA", "1188": "CABA", "1189": "CABA",
  "1190": "CABA", "1191": "CABA", "1192": "CABA", "1193": "CABA",
  "1194": "CABA", "1195": "CABA", "1196": "CABA", "1197": "CABA",
  "1198": "CABA", "1199": "CABA", "1200": "CABA", "1201": "CABA",
  "1202": "CABA", "1203": "CABA", "1204": "CABA", "1205": "CABA",
  "1206": "CABA", "1207": "CABA", "1208": "CABA", "1209": "CABA",
  "1210": "CABA", "1211": "CABA", "1212": "CABA", "1213": "CABA",
  "1214": "CABA", "1215": "CABA", "1216": "CABA", "1217": "CABA",
  "1218": "CABA", "1219": "CABA", "1220": "CABA", "1221": "CABA",
  "1222": "CABA", "1223": "CABA", "1224": "CABA", "1225": "CABA",
  "1226": "CABA", "1227": "CABA", "1228": "CABA", "1229": "CABA",
  "1230": "CABA", "1231": "CABA", "1232": "CABA", "1233": "CABA",
  "1234": "CABA", "1235": "CABA", "1236": "CABA", "1237": "CABA",
  "1238": "CABA", "1239": "CABA", "1240": "CABA", "1241": "CABA",
  "1242": "CABA", "1243": "CABA", "1244": "CABA", "1245": "CABA",
  "1246": "CABA", "1247": "CABA", "1248": "CABA", "1249": "CABA",
  "1250": "CABA", "1270": "CABA", "1280": "CABA", "1290": "CABA",
  "1300": "CABA", "1305": "CABA", "1306": "CABA", "1307": "CABA",
  "1308": "CABA", "1309": "CABA", "1310": "CABA", "1320": "CABA",
  "1330": "CABA", "1335": "CABA", "1340": "CABA", "1343": "CABA",
  "1344": "CABA", "1345": "CABA", "1346": "CABA", "1348": "CABA",
  "1350": "CABA", "1355": "CABA", "1360": "CABA", "1362": "CABA",
  "1363": "CABA", "1364": "CABA", "1365": "CABA", "1366": "CABA",
  "1368": "CABA", "1369": "CABA", "1370": "CABA", "1371": "CABA",
  "1372": "CABA", "1373": "CABA", "1374": "CABA", "1376": "CABA",
  "1380": "CABA", "1382": "CABA", "1384": "CABA", "1385": "CABA",
  "1386": "CABA", "1388": "CABA", "1390": "CABA", "1391": "CABA",
  "1392": "CABA", "1393": "CABA", "1394": "CABA", "1395": "CABA",
  "1396": "CABA", "1397": "CABA", "1398": "CABA", "1399": "CABA",
  "1400": "CABA", "1401": "CABA", "1402": "CABA", "1403": "CABA",
  "1404": "CABA", "1405": "CABA", "1406": "CABA", "1407": "CABA",
  "1408": "CABA", "1409": "CABA", "1410": "CABA", "1411": "CABA",
  "1412": "CABA", "1413": "CABA", "1414": "CABA", "1415": "CABA",
  "1416": "CABA", "1417": "CABA", "1419": "CABA", "1420": "CABA",
  "1421": "CABA", "1422": "CABA", "1423": "CABA", "1424": "CABA",
  "1425": "CABA", "1426": "CABA", "1427": "CABA", "1428": "CABA",
  "1429": "CABA", "1430": "CABA", "1431": "CABA", "1432": "CABA",
  "1433": "CABA", "1434": "CABA", "1435": "CABA", "1436": "CABA",
  "1437": "CABA", "1438": "CABA", "1439": "CABA", "1440": "CABA",
  "1441": "CABA", "1442": "CABA", "1443": "CABA", "1444": "CABA",
  "1445": "CABA", "1446": "CABA", "1447": "CABA", "1448": "CABA",
  "1449": "CABA", "1450": "CABA", "1451": "CABA", "1452": "CABA",
  "1453": "CABA", "1454": "CABA", "1455": "CABA", "1456": "CABA",
  "1457": "CABA", "1458": "CABA", "1459": "CABA", "1460": "CABA",
  "1461": "CABA", "1462": "CABA", "1463": "CABA", "1464": "CABA",
  "1465": "CABA", "1466": "CABA", "1467": "CABA", "1468": "CABA",
  "1469": "CABA", "1470": "CABA", "1471": "CABA", "1472": "CABA",
  "1473": "CABA", "1474": "CABA", "1475": "CABA", "1476": "CABA",
  "1477": "CABA", "1478": "CABA", "1479": "CABA", "1480": "CABA",
  // Hurlingham (Lejana)
  "1686": "Hurlingham", "1688": "Hurlingham",
  // Ituzaingó (Lejana)
  "1714": "Ituzaingó", "1715": "Ituzaingó",
  // José C. Paz (Lejana)
  "1665": "José C. Paz", "1666": "José C. Paz", "1667": "José C. Paz",
  "1668": "José C. Paz",
  // La Matanza Norte (Lejana)
  "1752": "La Matanza Norte", "1753": "La Matanza Norte",
  "1760": "La Matanza Norte", "1761": "La Matanza Norte",
  "1762": "La Matanza Norte", "1763": "La Matanza Norte",
  // Lanús (Lejana)
  "1820": "Lanús", "1821": "Lanús", "1822": "Lanús", "1823": "Lanús",
  "1824": "Lanús", "1825": "Lanús",
  // Lomas de Zamora (Lejana)
  "1832": "Lomas de Zamora", "1833": "Lomas de Zamora", "1834": "Lomas de Zamora",
  "1835": "Lomas de Zamora", "1836": "Lomas de Zamora",
  // Malvinas Argentinas (Lejana)
  "1613": "Malvinas Argentinas", "1614": "Malvinas Argentinas",
  "1615": "Malvinas Argentinas",
  // Merlo (Lejana)
  "1723": "Merlo", "1724": "Merlo", "1725": "Merlo",
  // Moreno (Lejana)
  "1744": "Moreno", "1745": "Moreno", "1746": "Moreno", "1747": "Moreno",
  "1749": "Moreno", "1750": "Moreno", "1751": "Moreno",
  // Morón (Lejana)
  "1708": "Morón", "1709": "Morón", "1710": "Morón", "1711": "Morón",
  "1712": "Morón",
  // Quilmes (Lejana)
  "1878": "Quilmes", "1879": "Quilmes",
  // San Fernando (Lejana)
  "1646": "San Fernando", "1647": "San Fernando",
  // San Isidro (Lejana)
  "1642": "San Isidro", "1643": "San Isidro", "1644": "San Isidro",
  "1645": "San Isidro",
  // San Martín (Lejana)
  "1650": "San Martín", "1651": "San Martín", "1652": "San Martín",
  "1653": "San Martín", "1654": "San Martín",
  // San Miguel (Lejana)
  "1661": "San Miguel", "1662": "San Miguel", "1663": "San Miguel",
  "1664": "San Miguel",
  // Tigre (Lejana)
  "1618": "Tigre", "1620": "Tigre", "1621": "Tigre", "1648": "Tigre",
  // Tres de Febrero (Lejana)
  "1674": "Tres de Febrero", "1675": "Tres de Febrero", "1676": "Tres de Febrero",
  "1677": "Tres de Febrero", "1678": "Tres de Febrero", "1679": "Tres de Febrero",
  "1680": "Tres de Febrero", "1682": "Tres de Febrero", "1683": "Tres de Febrero",
  "1684": "Tres de Febrero",
  // Vicente López (Lejana)
  "1638": "Vicente López", "1639": "Vicente López", "1640": "Vicente López",
  "1641": "Vicente López",
};

// Detectar localidad por CP numérico en el texto OCR
function detectCPFromText(text: string): string | null {
  // Buscar patrones: "CP: 1888", "CP 1888", "C.P. 1888", o simplemente 4 dígitos solos
  const patterns = [
    /CP[:\s.]*(\d{4})/i,
    /C\.P\.[:\s]*(\d{4})/i,
    /\bCP(\d{4})\b/i,
    /\b(\d{4})\b/g,
  ];
  for (const pattern of patterns) {
    if (pattern.flags.includes("g")) {
      // Para el patrón global, usar exec en bucle (compatible con ES5)
      const re = new RegExp(pattern.source, pattern.flags);
      let match = re.exec(text);
      while (match !== null) {
        const loc = CP_MAP[match[1]];
        if (loc) return loc;
        match = re.exec(text);
      }
    } else {
      const match = text.match(pattern);
      if (match) {
        const loc = CP_MAP[match[1]];
        if (loc) return loc;
      }
    }
  }
  return null;
}

function detectLocalidadFromText(text: string): string | null {
  const upper = text.toUpperCase().replace(/\n/g, " ").replace(/\s+/g, " ");

  // 1. Primero intentar por CP (muy confiable)
  const byCP = detectCPFromText(upper);
  if (byCP) return byCP;

  // 2. Ordenar por longitud descendente para priorizar nombres más largos
  const sorted = [...FLEX_LOCALIDADES].sort((a, b) => b.nombre.length - a.nombre.length);
  for (const loc of sorted) {
    const name = loc.nombre.toUpperCase()
      .replace(/\./g, "")
      .replace(/\s+/g, "\\s+");
    const regex = new RegExp(name);
    if (regex.test(upper)) return loc.nombre;
  }

  // 3. Aliases y variaciones comunes en etiquetas ML
  const aliases: Record<string, string> = {
    "FLORENCIO VARELA": "Florencio Varela",
    "TRES DE FEBRERO": "Tres de Febrero",
    "MARCOS PAZ": "Marcos Paz",
    "JOSE C PAZ": "José C. Paz",
    "JOSE C. PAZ": "José C. Paz",
    "ALTE BROWN": "Alte. Brown",
    "ALMIRANTE BROWN": "Alte. Brown",
    "GRAL RODRIGUEZ": "Gral. Rodríguez",
    "GENERAL RODRIGUEZ": "Gral. Rodríguez",
    "ING MASCHWITZ": "Ing. Maschwitz",
    "INGENIERO MASCHWITZ": "Ing. Maschwitz",
    "LA PLATA": "La Plata Centro",
    "VICENTE LOPEZ": "Vicente López",
    "LOMAS DE ZAMORA": "Lomas de Zamora",
    "SAN MARTIN": "San Martín",
    "SAN ISIDRO": "San Isidro",
    "SAN FERNANDO": "San Fernando",
    "SAN MIGUEL": "San Miguel",
    "SAN VICENTE": "San Vicente",
    "ITUZAINGO": "Ituzaingó",
    "MORON": "Morón",
    "LUJAN": "Luján",
    "ZARATE": "Zárate",
    "CANUELAS": "Cañuelas",
    "BERISSO": "Berisso",
    "ENSENADA": "Ensenada",
    "QUILMES": "Quilmes",
    "LANUS": "Lanús",
    "AVELLANEDA": "Avellaneda",
    "TIGRE": "Tigre",
    "PILAR": "Pilar",
    "CAMPANA": "Campana",
    "ZARATE": "Zárate",
    "GARIN": "Garín",
    "NORDELTA": "Nordelta",
    "ESCOBAR": "Escobar",
    "HURLINGHAM": "Hurlingham",
    "MERLO": "Merlo",
    "MORENO": "Moreno",
    "BERAZATEGUI": "Berazategui",
    "EZEIZA": "Ezeiza",
    "DERQUI": "Derqui",
    "GUERNICA": "Guernica",
  };
  for (const [alias, localidad] of Object.entries(aliases)) {
    if (upper.includes(alias)) return localidad;
  }
  return null;
}

function calcPaquete(localidad: string, tarifas: Record<FlexZona, number>) {
  const loc = FLEX_LOCALIDADES.find(l => l.nombre === localidad);
  const zona: FlexZona = loc?.zona ?? "lejana";
  const precioML = tarifas[zona];
  return { zona, precioML, pagoFlete: Math.round(precioML * 0.8), ganancia: Math.round(precioML * 0.2) };
}

// Preprocesar canvas: escala de grises con contraste suave (NO binarización dura)
function preprocessCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const dst = document.createElement("canvas");
  dst.width = src.width; dst.height = src.height;
  const ctx = dst.getContext("2d")!;
  ctx.drawImage(src, 0, 0);
  const imgData = ctx.getImageData(0, 0, dst.width, dst.height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // Contraste suave: estira el rango 50-220 a 0-255
    const contrasted = Math.min(255, Math.max(0, ((gray - 50) / 170) * 255));
    d[i] = d[i + 1] = d[i + 2] = contrasted;
  }
  ctx.putImageData(imgData, 0, 0);
  return dst;
}

export interface PaqueteOCR {
  id: string;
  localidad: string | null;
  zona: FlexZona | null;
  precioML: number;
  pagoFlete: number;
  ganancia: number;
  fotoDataUrl: string;
  ocrText: string;
  estado: "ok" | "sin_zona" | "procesando";
}

interface Props {
  tarifas: Record<FlexZona, number>;
  onFinish: (paquetes: PaqueteOCR[]) => void;
  onClose: () => void;
}

export default function OCRScanner({ tarifas, onFinish, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [paquetes, setPaquetes] = useState<PaqueteOCR[]>([]);
  const [camError, setCamError] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [workerReady, setWorkerReady] = useState(false);
  const workerRef = useRef<unknown>(null);

  const localidadesFiltradas = busqueda.trim()
    ? FLEX_LOCALIDADES.filter(l => l.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : FLEX_LOCALIDADES;

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch (e: unknown) {
      setCamError("No se pudo acceder a la cámara: " + (e instanceof Error ? e.message : String(e)));
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // Inicializar Tesseract worker — inglés + español para mejor lectura de texto de impresora
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createWorker } = await import("tesseract.js");
        const w = await createWorker("eng+spa", 1, {
          workerPath: "https://unpkg.com/tesseract.js@5.1.1/dist/worker.min.js",
          langPath: "https://tessdata.projectnaptha.com/4.0.0_fast",
          corePath: "https://unpkg.com/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js",
          logger: () => {},
        });
        if (!cancelled) {
          // Configurar para texto de impresora (PSMODE_SINGLE_BLOCK mejora rendimiento)
          await (w as { setParameters: (p: Record<string, string>) => Promise<void> }).setParameters({
            tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 :.-/",
          });
          workerRef.current = w;
          setWorkerReady(true);
        }
      } catch (_) {
        if (!cancelled) setWorkerReady(true);
      }
    })();
    return () => { cancelled = true; (workerRef.current as { terminate?: () => void })?.terminate?.(); };
  }, []);

  useEffect(() => { startCamera(); return () => stopCamera(); }, [startCamera, stopCamera]);

  const capturar = useCallback(async () => {
    if (capturing || paquetes.length >= MAX) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    setCapturing(true);
    navigator.vibrate?.(60);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    const fotoDataUrl = canvas.toDataURL("image/jpeg", 0.8);

    const id = generateId();
    const nuevo: PaqueteOCR = {
      id, localidad: null, zona: null, precioML: 0, pagoFlete: 0, ganancia: 0,
      fotoDataUrl, ocrText: "", estado: "procesando",
    };
    setPaquetes(prev => [...prev, nuevo]);
    setCapturing(false);

    // OCR en background
    (async () => {
      let localidad: string | null = null;
      let ocrText = "";

      try {
        if (workerRef.current) {
          const worker = workerRef.current as {
            recognize: (img: HTMLCanvasElement) => Promise<{ data: { text: string } }>
          };

          // INTENTO 1: Escanear la imagen completa preprocesada
          const processed = preprocessCanvas(canvas);
          const result1 = await worker.recognize(processed);
          ocrText = result1.data.text;
          localidad = detectLocalidadFromText(ocrText);

          // INTENTO 2: Si no encontró, escanear la imagen original sin preprocesar
          if (!localidad) {
            const result2 = await worker.recognize(canvas);
            ocrText += " " + result2.data.text;
            localidad = detectLocalidadFromText(ocrText);
          }

          // INTENTO 3: Si aún no encontró, recorte zona media de la foto
          if (!localidad) {
            const cropCanvas = document.createElement("canvas");
            cropCanvas.width = canvas.width;
            cropCanvas.height = Math.floor(canvas.height * 0.5);
            const cropCtx = cropCanvas.getContext("2d")!;
            cropCtx.drawImage(
              canvas,
              0, Math.floor(canvas.height * 0.25),
              canvas.width, cropCanvas.height,
              0, 0, cropCanvas.width, cropCanvas.height
            );
            const result3 = await worker.recognize(preprocessCanvas(cropCanvas));
            ocrText += " " + result3.data.text;
            localidad = detectLocalidadFromText(ocrText);
          }
        }
      } catch (_) {}

      const calc = localidad ? calcPaquete(localidad, tarifas) : { zona: null, precioML: 0, pagoFlete: 0, ganancia: 0 };
      setPaquetes(prev => prev.map(p => p.id === id ? {
        ...p,
        localidad,
        zona: calc.zona as FlexZona | null,
        precioML: calc.precioML,
        pagoFlete: calc.pagoFlete,
        ganancia: calc.ganancia,
        ocrText,
        estado: localidad ? "ok" : "sin_zona",
      } : p));
      if (localidad) beep();
    })();
  }, [capturing, paquetes.length, tarifas]);

  const editarLocalidad = (idx: number, localidad: string) => {
    const calc = calcPaquete(localidad, tarifas);
    setPaquetes(prev => prev.map((p, i) => i === idx ? {
      ...p, localidad, zona: calc.zona as FlexZona, precioML: calc.precioML,
      pagoFlete: calc.pagoFlete, ganancia: calc.ganancia, estado: "ok",
    } : p));
    setEditIdx(null); setBusqueda("");
  };

  const procesandoCount = paquetes.filter(p => p.estado === "procesando").length;
  const sinZonaCount = paquetes.filter(p => p.estado === "sin_zona").length;
  const okCount = paquetes.filter(p => p.estado === "ok").length;
  const totalML = paquetes.reduce((s, p) => s + p.precioML, 0);
  const totalGanancia = paquetes.reduce((s, p) => s + p.ganancia, 0);
  const totalFlete = paquetes.reduce((s, p) => s + p.pagoFlete, 0);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/90 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-yellow-400" />
          <div>
            <p className="text-white font-bold text-sm">Escáner OCR</p>
            <p className="text-gray-400 text-xs">
              {procesandoCount > 0
                ? `Procesando ${procesandoCount}...`
                : `${paquetes.length}/${MAX} fotos · ${okCount} detectadas`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {paquetes.length > 0 && (
            <button
              onClick={() => { stopCamera(); onFinish(paquetes); }}
              className="bg-yellow-500 text-black font-bold px-3 py-1.5 rounded-xl text-sm flex items-center gap-1"
            >
              <Save className="w-4 h-4" /> Guardar {okCount > 0 ? `(${okCount})` : ""}
            </button>
          )}
          <button onClick={() => { stopCamera(); onClose(); }} className="p-2 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Cámara */}
      <div className="relative flex-shrink-0" style={{ height: "55vw", maxHeight: "320px" }}>
        {camError ? (
          <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center text-center px-6">
            <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
            <p className="text-red-300 text-sm">{camError}</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />

            {/* Marco de enfoque */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-72 h-40">
                <div className="absolute top-0 left-0 w-7 h-7 border-yellow-400" style={{ borderWidth: "3px 0 0 3px" }} />
                <div className="absolute top-0 right-0 w-7 h-7 border-yellow-400" style={{ borderWidth: "3px 3px 0 0" }} />
                <div className="absolute bottom-0 left-0 w-7 h-7 border-yellow-400" style={{ borderWidth: "0 0 3px 3px" }} />
                <div className="absolute bottom-0 right-0 w-7 h-7 border-yellow-400" style={{ borderWidth: "0 3px 3px 0" }} />
                <p className="absolute -bottom-7 inset-x-0 text-center text-yellow-300 text-xs font-semibold">
                  Encuadrar la etiqueta completa — ciudad y CP visibles
                </p>
              </div>
            </div>

            {/* Contador */}
            <div className={`absolute top-3 right-3 rounded-xl px-3 py-1.5 text-center ${
              paquetes.length >= MAX ? "bg-red-600" : "bg-black/70"
            }`}>
              <p className="text-white font-black text-2xl leading-none">{paquetes.length}</p>
              <p className="text-gray-300 text-[10px]">/{MAX}</p>
            </div>

            {/* Indicador OCR cargando */}
            {!workerReady && (
              <div className="absolute top-3 left-3 bg-blue-600/90 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                <span className="text-white text-xs font-bold">Cargando OCR...</span>
              </div>
            )}
            {workerReady && procesandoCount > 0 && (
              <div className="absolute top-3 left-3 bg-blue-600/80 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                <span className="text-white text-xs font-bold">OCR {procesandoCount}</span>
              </div>
            )}

            {/* Botón capturar */}
            <button
              onPointerDown={capturar}
              disabled={capturing || paquetes.length >= MAX || !workerReady}
              className="absolute bottom-4 inset-x-0 flex justify-center pointer-events-auto"
            >
              <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all ${
                capturing
                  ? "border-gray-500 bg-gray-700"
                  : paquetes.length >= MAX
                  ? "border-red-600 bg-red-900/50"
                  : !workerReady
                  ? "border-yellow-500/50 bg-yellow-900/30"
                  : "border-white bg-white/20 active:bg-white/40"
              }`}>
                {capturing || (!workerReady) ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-7 h-7 text-white" />
                )}
              </div>
            </button>
          </>
        )}
      </div>

      {/* Lista de paquetes */}
      <div className="flex-1 overflow-y-auto bg-gray-950">
        {paquetes.length > 0 && (
          <div className="sticky top-0 bg-gray-900/95 border-b border-gray-700 px-4 py-2 flex justify-between z-10">
            <p className="text-xs text-gray-400">
              {sinZonaCount > 0 && <span className="text-red-400 font-bold">{sinZonaCount} sin zona · </span>}
              ML: <span className="text-white font-bold">{fmt(totalML)}</span>
            </p>
            <p className="text-green-300 font-black text-sm">Ganancia: {fmt(totalGanancia)}</p>
          </div>
        )}

        {paquetes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6 space-y-3">
            <Camera className="w-12 h-12 text-yellow-400/30 mb-1" />
            <p className="text-gray-400 text-sm font-semibold">Apuntá a la etiqueta completa</p>
            <p className="text-gray-600 text-xs">El OCR detecta la ciudad o el código postal (CP)</p>
            <div className="bg-gray-800/60 rounded-xl p-3 text-xs text-gray-400 space-y-1 text-left max-w-xs w-full">
              <p className="text-yellow-400 font-bold mb-1">Consejos para mejor lectura:</p>
              <p>• Buena luz sobre la etiqueta</p>
              <p>• La ciudad debe verse nítida</p>
              <p>• Incluir el CP: 1888 también sirve</p>
              <p>• Mantener el celular quieto al sacar la foto</p>
            </div>
            {!workerReady && <p className="text-yellow-400/60 text-xs">Cargando motor OCR...</p>}
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {/* Resumen total */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-gray-800 rounded-xl p-2.5 text-center">
                <DollarSign className="w-3.5 h-3.5 text-yellow-400 mx-auto mb-0.5" />
                <p className="text-[10px] text-gray-400">Total ML</p>
                <p className="text-white font-black text-sm">{fmt(totalML)}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-2.5 text-center">
                <Package className="w-3.5 h-3.5 text-blue-400 mx-auto mb-0.5" />
                <p className="text-[10px] text-gray-400">Flete 80%</p>
                <p className="text-white font-black text-sm">{fmt(totalFlete)}</p>
              </div>
              <div className="bg-green-900/40 rounded-xl border border-green-700/50 p-2.5 text-center">
                <TrendingUp className="w-3.5 h-3.5 text-green-400 mx-auto mb-0.5" />
                <p className="text-[10px] text-gray-400">Ganancia</p>
                <p className="text-green-300 font-black text-sm">{fmt(totalGanancia)}</p>
              </div>
            </div>

            {[...paquetes].reverse().map((p, revIdx) => {
              const idx = paquetes.length - 1 - revIdx;
              return (
                <div key={p.id} className={`rounded-xl border overflow-hidden ${
                  p.estado === "sin_zona" ? "border-red-600/50 bg-red-900/10" :
                  p.estado === "procesando" ? "border-blue-600/30 bg-blue-900/10" :
                  "border-gray-700 bg-gray-800/50"
                }`}>
                  {editIdx === idx ? (
                    <div className="p-3 space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
                        <input autoFocus type="text" placeholder="Buscar localidad..."
                          value={busqueda} onChange={e => setBusqueda(e.target.value)}
                          className="w-full bg-gray-700 text-white rounded-lg pl-8 pr-3 py-2 text-sm border border-yellow-400 outline-none"
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {localidadesFiltradas.map(loc => (
                          <button key={loc.nombre} onClick={() => editarLocalidad(idx, loc.nombre)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-left">
                            <span className="text-white text-sm">{loc.nombre}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${ZONA_COLORS[loc.zona]}`}>{ZONA_LABELS[loc.zona]}</span>
                          </button>
                        ))}
                      </div>
                      <button onClick={() => { setEditIdx(null); setBusqueda(""); }} className="text-xs text-gray-500">Cancelar</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.fotoDataUrl} alt="" className="w-12 h-12 object-cover rounded-lg flex-shrink-0 border border-gray-600" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-gray-500 text-xs font-bold">#{idx + 1}</span>
                          {p.estado === "procesando" ? (
                            <span className="text-blue-300 text-xs flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> Leyendo...
                            </span>
                          ) : p.localidad ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                              <span className="text-white text-sm font-semibold">{p.localidad}</span>
                              {p.zona && <span className={`text-xs px-2 py-0.5 rounded-full border ${ZONA_COLORS[p.zona]}`}>{ZONA_LABELS[p.zona]}</span>}
                            </>
                          ) : (
                            <span className="text-red-400 text-sm font-bold">Sin zona — tocá para asignar</span>
                          )}
                        </div>
                        {p.localidad && (
                          <p className="text-gray-500 text-[10px] mt-0.5">{fmt(p.precioML)} · Gan: {fmt(p.ganancia)}</p>
                        )}
                      </div>
                      <button onClick={() => { setEditIdx(idx); setBusqueda(""); }}
                        className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                          p.estado === "sin_zona"
                            ? "bg-red-600 text-white animate-pulse"
                            : "bg-gray-700 text-gray-400 hover:text-yellow-300"
                        }`}>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
