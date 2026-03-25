"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { FlexZona, FLEX_LOCALIDADES } from "@/lib/types";
import { X, Zap, Search, ChevronRight, AlertTriangle } from "lucide-react";

const ZONA_COLORS: Record<FlexZona, string> = {
  cercana: "bg-green-500/20 text-green-300 border-green-500/40",
  media:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  lejana:  "bg-red-500/20 text-red-300 border-red-500/40",
};
const ZONA_LABELS: Record<FlexZona, string> = {
  cercana: "Cercana", media: "Media", lejana: "Lejana",
};

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1200;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch (_) {}
}

function vibrate() {
  try { navigator.vibrate?.(80); } catch (_) {}
}

function extractShipmentId(qrData: string): string {
  // Pack ID de ML: 20000XXXXXXXXX
  const pack = qrData.match(/\b(20000\d{8,})\b/);
  if (pack) return pack[1];
  const envio = qrData.match(/envio[:\s=]*(\d{8,})/i);
  if (envio) return envio[1];
  const match = qrData.match(/([A-Za-z0-9]{8,})/);
  return match ? match[1] : qrData.slice(0, 30);
}

// Mapa de CPs argentinos → Localidad (zonas de entrega MAQJEEZ)
const CP_MAP: Record<string, string> = {
  // Ezeiza
  "1802": "Ezeiza", "1803": "Ezeiza", "1804": "Ezeiza",
  // Esteban Echeverría
  "1843": "Esteban Echeverría", "1844": "Esteban Echeverría",
  // CABA (rangos)
  "1000": "CABA","1001":"CABA","1002":"CABA","1003":"CABA","1004":"CABA","1005":"CABA",
  "1006":"CABA","1007":"CABA","1008":"CABA","1009":"CABA","1010":"CABA","1011":"CABA",
  "1012":"CABA","1013":"CABA","1014":"CABA","1015":"CABA","1016":"CABA","1017":"CABA",
  "1018":"CABA","1019":"CABA","1020":"CABA","1021":"CABA","1022":"CABA","1023":"CABA",
  "1024":"CABA","1025":"CABA","1026":"CABA","1027":"CABA","1028":"CABA","1029":"CABA",
  "1030":"CABA","1031":"CABA","1032":"CABA","1033":"CABA","1034":"CABA","1035":"CABA",
  "1036":"CABA","1037":"CABA","1038":"CABA","1039":"CABA","1040":"CABA","1041":"CABA",
  "1042":"CABA","1043":"CABA","1044":"CABA","1045":"CABA","1046":"CABA","1047":"CABA",
  "1048":"CABA","1049":"CABA","1050":"CABA","1051":"CABA","1052":"CABA","1053":"CABA",
  "1054":"CABA","1055":"CABA","1056":"CABA","1057":"CABA","1058":"CABA","1059":"CABA",
  "1060":"CABA","1061":"CABA","1062":"CABA","1063":"CABA","1064":"CABA","1065":"CABA",
  "1066":"CABA","1067":"CABA","1068":"CABA","1069":"CABA","1070":"CABA","1071":"CABA",
  "1072":"CABA","1073":"CABA","1074":"CABA","1075":"CABA","1076":"CABA","1077":"CABA",
  "1078":"CABA","1079":"CABA","1080":"CABA","1081":"CABA","1082":"CABA","1083":"CABA",
  "1084":"CABA","1085":"CABA","1086":"CABA","1087":"CABA","1088":"CABA","1089":"CABA",
  "1090":"CABA","1091":"CABA","1092":"CABA","1093":"CABA","1094":"CABA","1095":"CABA",
  "1096":"CABA","1097":"CABA","1098":"CABA","1099":"CABA",
  "1100":"CABA","1101":"CABA","1102":"CABA","1103":"CABA","1104":"CABA","1105":"CABA",
  "1106":"CABA","1107":"CABA","1108":"CABA","1109":"CABA","1110":"CABA","1111":"CABA",
  "1112":"CABA","1113":"CABA","1114":"CABA","1115":"CABA","1116":"CABA","1117":"CABA",
  "1118":"CABA","1119":"CABA","1120":"CABA","1121":"CABA","1122":"CABA","1123":"CABA",
  "1124":"CABA","1125":"CABA","1126":"CABA","1127":"CABA","1128":"CABA","1129":"CABA",
  "1130":"CABA","1131":"CABA","1132":"CABA","1133":"CABA","1134":"CABA","1135":"CABA",
  "1136":"CABA","1137":"CABA","1138":"CABA","1139":"CABA","1140":"CABA","1141":"CABA",
  "1142":"CABA","1143":"CABA","1144":"CABA","1145":"CABA","1146":"CABA","1147":"CABA",
  "1148":"CABA","1149":"CABA","1150":"CABA","1151":"CABA","1152":"CABA","1153":"CABA",
  "1154":"CABA","1155":"CABA","1156":"CABA","1157":"CABA","1158":"CABA","1159":"CABA",
  "1160":"CABA","1161":"CABA","1162":"CABA","1163":"CABA","1164":"CABA","1165":"CABA",
  "1166":"CABA","1167":"CABA","1168":"CABA","1169":"CABA","1170":"CABA","1171":"CABA",
  "1172":"CABA","1173":"CABA","1174":"CABA","1175":"CABA","1176":"CABA","1177":"CABA",
  "1178":"CABA","1179":"CABA","1180":"CABA","1181":"CABA","1182":"CABA","1183":"CABA",
  "1184":"CABA","1185":"CABA","1186":"CABA","1187":"CABA","1188":"CABA","1189":"CABA",
  "1190":"CABA","1191":"CABA","1192":"CABA","1193":"CABA","1194":"CABA","1195":"CABA",
  "1196":"CABA","1197":"CABA","1198":"CABA","1199":"CABA",
  "1200":"CABA","1201":"CABA","1202":"CABA","1203":"CABA","1204":"CABA","1205":"CABA",
  "1206":"CABA","1207":"CABA","1208":"CABA","1209":"CABA","1210":"CABA","1211":"CABA",
  "1212":"CABA","1213":"CABA","1214":"CABA","1215":"CABA","1216":"CABA","1217":"CABA",
  "1218":"CABA","1219":"CABA","1220":"CABA","1221":"CABA","1222":"CABA","1223":"CABA",
  "1224":"CABA","1225":"CABA","1226":"CABA","1227":"CABA","1228":"CABA","1229":"CABA",
  "1230":"CABA","1231":"CABA","1232":"CABA","1233":"CABA","1234":"CABA","1235":"CABA",
  "1236":"CABA","1237":"CABA","1238":"CABA","1239":"CABA","1240":"CABA","1241":"CABA",
  "1242":"CABA","1243":"CABA","1244":"CABA","1245":"CABA","1246":"CABA","1247":"CABA",
  "1248":"CABA","1249":"CABA","1250":"CABA","1251":"CABA","1252":"CABA","1253":"CABA",
  "1254":"CABA","1255":"CABA","1256":"CABA","1257":"CABA","1258":"CABA","1259":"CABA",
  "1260":"CABA","1261":"CABA","1262":"CABA","1263":"CABA","1264":"CABA","1265":"CABA",
  "1266":"CABA","1267":"CABA","1268":"CABA","1269":"CABA","1270":"CABA","1271":"CABA",
  "1272":"CABA","1273":"CABA","1274":"CABA","1275":"CABA","1276":"CABA","1277":"CABA",
  "1278":"CABA","1279":"CABA","1280":"CABA","1281":"CABA","1282":"CABA","1283":"CABA",
  "1284":"CABA","1285":"CABA","1286":"CABA","1287":"CABA","1288":"CABA","1289":"CABA",
  "1290":"CABA","1291":"CABA","1292":"CABA","1293":"CABA","1294":"CABA","1295":"CABA",
  "1296":"CABA","1297":"CABA","1298":"CABA","1299":"CABA",
  "1300":"CABA","1301":"CABA","1302":"CABA","1303":"CABA","1304":"CABA","1305":"CABA",
  "1306":"CABA","1307":"CABA","1308":"CABA","1309":"CABA","1310":"CABA","1311":"CABA",
  "1312":"CABA","1313":"CABA","1314":"CABA","1315":"CABA","1316":"CABA","1317":"CABA",
  "1318":"CABA","1319":"CABA","1320":"CABA","1321":"CABA","1322":"CABA","1323":"CABA",
  "1324":"CABA","1325":"CABA","1326":"CABA","1327":"CABA","1328":"CABA","1329":"CABA",
  "1330":"CABA","1331":"CABA","1332":"CABA","1333":"CABA","1334":"CABA","1335":"CABA",
  "1336":"CABA","1337":"CABA","1338":"CABA","1339":"CABA","1340":"CABA","1341":"CABA",
  "1342":"CABA","1343":"CABA","1344":"CABA","1345":"CABA","1346":"CABA","1347":"CABA",
  "1348":"CABA","1349":"CABA","1350":"CABA","1351":"CABA","1352":"CABA","1353":"CABA",
  "1354":"CABA","1355":"CABA","1356":"CABA","1357":"CABA","1358":"CABA","1359":"CABA",
  "1360":"CABA","1361":"CABA","1362":"CABA","1363":"CABA","1364":"CABA","1365":"CABA",
  "1366":"CABA","1367":"CABA","1368":"CABA","1369":"CABA","1370":"CABA","1371":"CABA",
  "1372":"CABA","1373":"CABA","1374":"CABA","1375":"CABA","1376":"CABA","1377":"CABA",
  "1378":"CABA","1379":"CABA","1380":"CABA","1381":"CABA","1382":"CABA","1383":"CABA",
  "1384":"CABA","1385":"CABA","1386":"CABA","1387":"CABA","1388":"CABA","1389":"CABA",
  "1390":"CABA","1391":"CABA","1392":"CABA","1393":"CABA","1394":"CABA","1395":"CABA",
  "1396":"CABA","1397":"CABA","1398":"CABA","1399":"CABA",
  "1400":"CABA","1401":"CABA","1402":"CABA","1403":"CABA","1404":"CABA","1405":"CABA",
  "1406":"CABA","1407":"CABA","1408":"CABA","1409":"CABA","1410":"CABA","1411":"CABA",
  "1412":"CABA","1413":"CABA","1414":"CABA","1415":"CABA","1416":"CABA","1417":"CABA",
  "1418":"CABA","1419":"CABA","1420":"CABA","1421":"CABA","1422":"CABA","1423":"CABA",
  "1424":"CABA","1425":"CABA","1426":"CABA","1427":"CABA","1428":"CABA","1429":"CABA",
  "1430":"CABA","1431":"CABA","1432":"CABA","1433":"CABA","1434":"CABA","1435":"CABA",
  "1436":"CABA","1437":"CABA","1438":"CABA","1439":"CABA","1440":"CABA","1441":"CABA",
  "1442":"CABA","1443":"CABA","1444":"CABA","1445":"CABA","1446":"CABA","1447":"CABA",
  "1448":"CABA","1449":"CABA","1450":"CABA","1451":"CABA","1452":"CABA","1453":"CABA",
  "1454":"CABA","1455":"CABA","1456":"CABA","1457":"CABA","1458":"CABA","1459":"CABA",
  "1460":"CABA","1461":"CABA","1462":"CABA","1463":"CABA","1464":"CABA","1465":"CABA",
  "1466":"CABA","1467":"CABA","1468":"CABA","1469":"CABA","1470":"CABA","1471":"CABA",
  "1472":"CABA","1473":"CABA","1474":"CABA","1475":"CABA","1476":"CABA","1477":"CABA",
  "1478":"CABA","1479":"CABA","1480":"CABA","1481":"CABA","1482":"CABA","1483":"CABA",
  "1484":"CABA","1485":"CABA","1486":"CABA","1487":"CABA","1488":"CABA","1489":"CABA",
  "1490":"CABA","1491":"CABA","1492":"CABA","1493":"CABA","1494":"CABA","1495":"CABA",
  "1496":"CABA","1497":"CABA","1498":"CABA","1499":"CABA",
  // Vicente López
  "1636":"Vicente López","1637":"Vicente López","1638":"Vicente López","1639":"Vicente López",
  // San Isidro
  "1640":"San Isidro","1641":"San Isidro","1642":"San Isidro","1643":"San Isidro","1644":"San Isidro",
  // San Fernando
  "1645":"San Fernando","1646":"San Fernando","1647":"San Fernando","1648":"San Fernando",
  // San Martín
  "1650":"San Martín","1651":"San Martín","1652":"San Martín","1653":"San Martín","1654":"San Martín",
  // San Miguel
  "1663":"San Miguel","1664":"San Miguel","1665":"San Miguel",
  // José C. Paz
  "1666":"José C. Paz","1667":"José C. Paz","1668":"José C. Paz",
  // Del Viso
  "1669": "Del Viso",
  // Nordelta / Tigre
  "1670":"Nordelta","1618":"Tigre","1619":"Garín","1620":"Tigre",
  // Tres de Febrero
  "1672":"Tres de Febrero","1673":"Tres de Febrero","1674":"Tres de Febrero",
  "1675":"Tres de Febrero","1676":"Tres de Febrero","1677":"Tres de Febrero",
  "1678":"Tres de Febrero","1679":"Tres de Febrero","1680":"Tres de Febrero",
  "1681":"Tres de Febrero","1682":"Tres de Febrero","1683":"Tres de Febrero","1684":"Tres de Febrero",
  // Hurlingham
  "1686":"Hurlingham","1687":"Hurlingham","1688":"Hurlingham",
  // Ituzaingó
  "1714":"Ituzaingó","1715":"Ituzaingó","1716":"Ituzaingó",
  // Morón
  "1708":"Morón","1709":"Morón","1710":"Morón","1711":"Morón","1712":"Morón",
  // Merlo
  "1720":"Merlo","1721":"Merlo","1722":"Merlo",
  // Marcos Paz
  "1727":"Marcos Paz",
  // La Matanza Norte / Sur
  "1752":"La Matanza Norte","1753":"La Matanza Norte","1754":"La Matanza Norte",
  "1755":"La Matanza Norte","1756":"La Matanza Norte","1757":"La Matanza Norte",
  "1758":"La Matanza Norte","1759":"La Matanza Norte","1760":"La Matanza Norte",
  "1761":"La Matanza Norte","1762":"La Matanza Norte","1763":"La Matanza Norte",
  "1764":"La Matanza Norte","1765":"La Matanza Norte","1766":"La Matanza Norte","1767":"La Matanza Norte",
  "1750":"La Matanza Sur","1751":"La Matanza Sur",
  // Moreno
  "1744":"Moreno","1745":"Moreno","1746":"Moreno","1747":"Moreno",
  // Gral. Rodríguez
  "1748": "Gral. Rodríguez",
  // Malvinas Argentinas
  "1613":"Malvinas Argentinas","1614":"Malvinas Argentinas","1615":"Malvinas Argentinas","1616":"Malvinas Argentinas",
  // Escobar / Ing. Maschwitz
  "1625":"Escobar","1626":"Ing. Maschwitz",
  // Pilar / Derqui / Villa Rosa
  "1629":"Pilar","1630":"Pilar","1631":"Derqui","1632":"Pilar","1633":"Pilar","1634":"Pilar","1635":"Pilar",
  // Alte. Brown
  "1840":"Alte. Brown","1841":"Alte. Brown","1842":"Alte. Brown","1845":"Alte. Brown","1846":"Alte. Brown","1848":"Alte. Brown","1850":"Alte. Brown",
  // Lomas de Zamora
  "1832":"Lomas de Zamora","1833":"Lomas de Zamora","1834":"Lomas de Zamora","1835":"Lomas de Zamora","1836":"Lomas de Zamora",
  // Lanús
  "1824":"Lanús","1825":"Lanús","1826":"Lanús",
  // Avellaneda
  "1870":"Avellaneda","1871":"Avellaneda","1872":"Avellaneda","1873":"Avellaneda","1874":"Avellaneda","1875":"Avellaneda",
  // Quilmes
  "1877":"Quilmes","1878":"Quilmes","1879":"Quilmes","1880":"Quilmes","1881":"Quilmes","1882":"Quilmes",
  // Berazategui
  "1883":"Berazategui","1884":"Berazategui","1885":"Berazategui","1886":"Berazategui",
  // Florencio Varela
  "1888":"Florencio Varela","1889":"Florencio Varela","1890":"Florencio Varela","1891":"Florencio Varela",
  // Cañuelas
  "1814":"Cañuelas",
  // San Vicente
  "1815":"San Vicente",
  // Guernica
  "1856":"Guernica",
  // La Plata
  "1900":"La Plata Centro","1901":"La Plata Centro","1902":"La Plata Centro","1903":"La Plata Centro","1904":"La Plata Centro",
  "1905":"La Plata Centro","1906":"La Plata Norte","1907":"La Plata Norte","1908":"La Plata Norte","1909":"La Plata Oeste",
  "1910":"La Plata Oeste","1911":"La Plata Norte","1912":"La Plata Norte","1913":"La Plata Norte",
  "1914":"La Plata Norte","1915":"La Plata Norte","1916":"La Plata Norte","1917":"La Plata Oeste","1918":"La Plata Oeste","1920":"La Plata Oeste",
  // Berisso
  "1923":"Berisso","1924":"Berisso","1925":"Berisso",
  // Ensenada
  "1926":"Ensenada","1927":"Ensenada",
  // Luján
  "6700":"Luján","6701":"Luján","6702":"Luján",
  // Zárate / Campana
  "2800":"Zárate","2801":"Zárate","2804":"Campana","2805":"Campana",
};

function extractCPFromQR(qrData: string): string | null {
  // ML QR puede traer CP en formato "CP: 1682" o "CP:1682" o solo "1682"
  const explicit = qrData.match(/CP[:\s]*(\d{4,5})/i);
  if (explicit) return explicit[1];
  // Buscar código de 4 dígitos que matchee con nuestra tabla
  const matches = qrData.match(/\b(\d{4})\b/g);
  if (matches) {
    for (const cp of matches) {
      if (CP_MAP[cp]) return cp;
    }
  }
  return null;
}

function detectLocalidad(qrData: string): string | null {
  // 1. Intentar por CP primero (más preciso)
  const cp = extractCPFromQR(qrData);
  if (cp && CP_MAP[cp]) return CP_MAP[cp];

  // 2. Buscar nombre de ciudad en el texto del QR
  const upper = qrData.toUpperCase();
  const sorted = [...FLEX_LOCALIDADES].sort((a, b) => b.nombre.length - a.nombre.length);
  for (const loc of sorted) {
    if (upper.includes(loc.nombre.toUpperCase())) return loc.nombre;
  }
  return null;
}

export interface PaqueteQR {
  tempId: string;
  qrRaw: string;
  shipmentId: string;
  localidad: string | null;
  zona: FlexZona | null;
  precioML: number;
  pagoFlete: number;
  ganancia: number;
}

function calcPaquete(localidad: string, tarifas: Record<FlexZona, number>): {
  zona: FlexZona; precioML: number; pagoFlete: number; ganancia: number;
} {
  const loc = FLEX_LOCALIDADES.find(l => l.nombre === localidad);
  const zona: FlexZona = loc?.zona ?? "lejana";
  const precioML = tarifas[zona];
  return { zona, precioML, pagoFlete: Math.round(precioML * 0.8), ganancia: Math.round(precioML * 0.2) };
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

interface Props {
  tarifas: Record<FlexZona, number>;
  maxPaquetes?: number;
  onFinish: (paquetes: PaqueteQR[]) => void;
  onClose: () => void;
}

export default function QRScanner({ tarifas, maxPaquetes = 50, onFinish, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const scannedIds = useRef<Set<string>>(new Set());

  const [paquetes, setPaquetes] = useState<PaqueteQR[]>([]);
  const [scanning, setScanning] = useState(true);
  const [lastScan, setLastScan] = useState<string>("");
  const [camError, setCamError] = useState<string>("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [cooldown, setCooldown] = useState(false);

  const localidadesFiltradas = busqueda.trim()
    ? FLEX_LOCALIDADES.filter(l => l.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : FLEX_LOCALIDADES;

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        scanLoop();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setCamError("No se pudo acceder a la cámara: " + msg);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const onQRDetected = useCallback((qrData: string) => {
    if (cooldown) return;
    const shipmentId = extractShipmentId(qrData);
    if (scannedIds.current.has(shipmentId)) {
      // Duplicado — vibración larga
      navigator.vibrate?.([80, 80, 80]);
      setLastScan("DUPLICADO: " + shipmentId);
      return;
    }
    scannedIds.current.add(shipmentId);
    beep();
    vibrate();
    setCooldown(true);
    setTimeout(() => setCooldown(false), 800);

    const localidad = detectLocalidad(qrData);
    const calc = localidad ? calcPaquete(localidad, tarifas) : { zona: null as FlexZona | null, precioML: 0, pagoFlete: 0, ganancia: 0 };

    const nuevo: PaqueteQR = {
      tempId:     generateId(),
      qrRaw:      qrData,
      shipmentId,
      localidad,
      zona:       calc.zona,
      precioML:   calc.precioML,
      pagoFlete:  calc.pagoFlete,
      ganancia:   calc.ganancia,
    };

    setPaquetes(prev => {
      const updated = [...prev, nuevo];
      setLastScan(shipmentId + (localidad ? ` → ${localidad}` : " → Sin zona"));
      if (updated.length >= maxPaquetes) {
        setScanning(false);
        stopCamera();
      }
      return updated;
    });
  }, [cooldown, tarifas, maxPaquetes, stopCamera]);

  const scanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animRef.current = requestAnimationFrame(scanLoop);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    if (code) onQRDetected(code.data);
    animRef.current = requestAnimationFrame(scanLoop);
  }, [onQRDetected]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const editarLocalidad = (idx: number, localidad: string) => {
    const calc = calcPaquete(localidad, tarifas);
    setPaquetes(prev => prev.map((p, i) => i === idx
      ? { ...p, localidad, zona: calc.zona, precioML: calc.precioML, pagoFlete: calc.pagoFlete, ganancia: calc.ganancia }
      : p
    ));
    setEditIdx(null);
    setBusqueda("");
  };

  const totalGanancia = paquetes.reduce((s, p) => s + p.ganancia, 0);
  const totalML = paquetes.reduce((s, p) => s + p.precioML, 0);
  const sinZona = paquetes.filter(p => !p.localidad).length;
  const fmt = (n: number) => "$" + n.toLocaleString("es-AR");

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm flex-shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          <div>
            <p className="text-white font-bold text-sm">Escáner QR Ráfaga</p>
            <p className="text-gray-400 text-xs">{paquetes.length}/{maxPaquetes} escaneados</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(paquetes.length > 0 || !scanning) && (
            <button
              onClick={() => { stopCamera(); onFinish(paquetes); }}
              className="bg-yellow-500 text-black font-bold px-3 py-1.5 rounded-xl text-sm"
            >
              Finalizar →
            </button>
          )}
          <button onClick={() => { stopCamera(); onClose(); }} className="p-2 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Contador gigante + cámara */}
      <div className="relative flex-shrink-0" style={{ height: "55vw", maxHeight: "320px" }}>
        {camError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-center px-6">
            <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
            <p className="text-red-300 text-sm font-semibold">{camError}</p>
            <p className="text-gray-500 text-xs mt-2">Usá el modo manual (botón Ráfaga)</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Overlay de escaneo */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-48 h-48">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-yellow-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-yellow-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-yellow-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-yellow-400 rounded-br-lg" />
                {scanning && (
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-yellow-400 opacity-80 animate-scan" />
                )}
              </div>
            </div>

            {/* Contador en esquina */}
            <div className={`absolute top-3 right-3 rounded-2xl px-4 py-2 text-center shadow-lg ${
              paquetes.length >= maxPaquetes ? "bg-red-600" : "bg-black/70 backdrop-blur-sm"
            }`}>
              <p className="text-white font-black text-3xl leading-none">{paquetes.length}</p>
              <p className="text-gray-300 text-xs">/{maxPaquetes}</p>
            </div>

            {/* Último scan */}
            {lastScan && (
              <div className="absolute bottom-3 left-3 right-3 bg-black/80 backdrop-blur-sm rounded-xl px-3 py-2">
                <p className="text-yellow-300 text-xs font-mono truncate">{lastScan}</p>
              </div>
            )}

            {!scanning && paquetes.length >= maxPaquetes && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-white font-black text-xl">Límite alcanzado</p>
                  <p className="text-yellow-300 text-sm">Tocá &quot;Finalizar&quot; arriba</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Lista de paquetes escaneados */}
      <div className="flex-1 overflow-y-auto bg-gray-950">

        {/* Barra resumen */}
        {paquetes.length > 0 && (
          <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center justify-between z-10">
            <p className="text-gray-400 text-xs">
              {sinZona > 0 && <span className="text-red-400 font-bold">{sinZona} sin zona · </span>}
              ML: <span className="text-white font-bold">{fmt(totalML)}</span>
            </p>
            <p className="text-green-300 font-black text-sm">Ganancia: {fmt(totalGanancia)}</p>
          </div>
        )}

        {paquetes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-yellow-500/40 flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-yellow-400/50" />
            </div>
            <p className="text-gray-400 text-sm">Apuntá la cámara al código QR del paquete</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {[...paquetes].reverse().map((p, revIdx) => {
              const idx = paquetes.length - 1 - revIdx;
              return (
                <div
                  key={p.tempId}
                  className={`rounded-xl border p-3 ${
                    !p.localidad ? "bg-red-900/20 border-red-600/50" : "bg-gray-800/60 border-gray-700"
                  }`}
                >
                  {editIdx === idx ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Buscar localidad..."
                          value={busqueda}
                          onChange={e => setBusqueda(e.target.value)}
                          className="w-full bg-gray-700 text-white rounded-lg pl-8 pr-3 py-2 text-sm border border-yellow-400 outline-none"
                        />
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {localidadesFiltradas.map(loc => (
                          <button
                            key={loc.nombre}
                            onClick={() => editarLocalidad(idx, loc.nombre)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-left"
                          >
                            <span className="text-white text-sm">{loc.nombre}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${ZONA_COLORS[loc.zona]}`}>
                              {ZONA_LABELS[loc.zona]}
                            </span>
                          </button>
                        ))}
                      </div>
                      <button onClick={() => { setEditIdx(null); setBusqueda(""); }} className="text-xs text-gray-500">Cancelar</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-gray-500 text-xs font-bold">#{idx + 1}</span>
                          {p.localidad ? (
                            <>
                              <span className="text-white text-sm font-semibold">{p.localidad}</span>
                              {p.zona && (
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${ZONA_COLORS[p.zona]}`}>
                                  {ZONA_LABELS[p.zona]}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-red-400 text-sm font-bold">Sin zona — tocar para asignar</span>
                          )}
                        </div>
                        <p className="text-gray-600 text-[10px] font-mono truncate mt-0.5">{p.shipmentId}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {p.localidad && (
                          <div className="text-right">
                            <p className="text-white text-xs font-bold">{fmt(p.precioML)}</p>
                            <p className="text-green-300 text-[10px]">{fmt(p.ganancia)}</p>
                          </div>
                        )}
                        <button
                          onClick={() => { setEditIdx(idx); setBusqueda(""); }}
                          className={`p-1.5 rounded-lg text-sm font-bold transition-colors ${
                            !p.localidad
                              ? "bg-red-600 text-white animate-pulse"
                              : "bg-gray-700 text-gray-400 hover:text-yellow-300"
                          }`}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          50% { transform: translateY(184px); }
          100% { transform: translateY(0); }
        }
        .animate-scan { animation: scan 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
