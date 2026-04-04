/**
 * QZ Tray 2.x WebSocket client for RAW ZPL printing.
 * Requires QZ Tray installed: https://qz.io/download/
 *
 * Setup (once):
 *   1. Install QZ Tray from https://qz.io/download/
 *   2. Start QZ Tray (it runs in the system tray)
 *   3. Right-click QZ Tray icon → Advanced → uncheck "Block anonymous requests"
 *   4. Visit https://localhost:8181 in Chrome and accept the certificate warning
 */

// Official QZ Tray 2.x endpoints — no path suffix
const QZ_WS_SECURE   = "wss://localhost:8181";
const QZ_WS_INSECURE = "ws://localhost:8182";

const CONNECT_TIMEOUT      = 6_000;
const CALL_TIMEOUT         = 12_000;
const KEEPALIVE_INTERVAL   = 30_000; // 30s — safely under QZ Tray's idle timeout
const MAX_RECONNECT_ATTEMPTS = 10;

type QZMsg = {
  uid?:    string;
  call?:   string;
  result?: unknown;
  error?:  string;
};

// ── Module-level state ────────────────────────────────────────────────────────
let _ws: WebSocket | null = null;
let _connected = false;
const _pending = new Map<string, { resolve: (r: unknown) => void; reject: (e: Error) => void }>();

let _keepAliveTimer: ReturnType<typeof setInterval>  | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout>   | null = null;
let _reconnectAttempts = 0;
let _intentionalClose  = false;

// ── Keepalive helpers ─────────────────────────────────────────────────────────
function startKeepalive() {
  stopKeepalive();
  _keepAliveTimer = setInterval(() => {
    if (_ws?.readyState === WebSocket.OPEN) {
      // Exact string the official qz-tray.js uses — resets QZ Tray's idle timer
      _ws.send("ping");
    }
  }, KEEPALIVE_INTERVAL);
}

function stopKeepalive() {
  if (_keepAliveTimer) { clearInterval(_keepAliveTimer); _keepAliveTimer = null; }
}

// ── Public API ────────────────────────────────────────────────────────────────
export function isQZConnected(): boolean {
  return _connected && _ws?.readyState === WebSocket.OPEN;
}

export function disconnectQZ(): void {
  _intentionalClose = true;
  stopKeepalive();
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  // Reject any pending calls immediately
  Array.from(_pending.values()).forEach(({ reject: rej }) => {
    rej(new Error("Desconectado manualmente"));
  });
  _pending.clear();
  _ws?.close(1000, "client disconnect");
  _ws = null;
  _connected = false;
}

export function connectQZ(preferSecure = true): Promise<void> {
  if (isQZConnected()) return Promise.resolve();

  // Reset intentional close flag so reconnects work after manual disconnect
  _intentionalClose = false;

  return new Promise((resolve, reject) => {
    const url = preferSecure ? QZ_WS_SECURE : QZ_WS_INSECURE;
    let ws: WebSocket;

    try { ws = new WebSocket(url); }
    catch { reject(new Error("No se puede abrir WebSocket")); return; }

    const timer = setTimeout(() => {
      ws.close();
      if (preferSecure) {
        connectQZ(false).then(resolve).catch(() =>
          reject(new Error(
            "QZ Tray no responde. Verificá que esté instalado y ejecutándose en la bandeja del sistema."
          ))
        );
      } else {
        reject(new Error(
          "Timeout: QZ Tray no encontrado. Instalalo en https://qz.io, desactivá 'Block anonymous requests' " +
          "y aceptá el certificado en https://localhost:8181."
        ));
      }
    }, CONNECT_TIMEOUT);

    ws.onmessage = (ev: MessageEvent) => {
      let msg: QZMsg;
      try { msg = JSON.parse(ev.data as string); } catch { return; }

      // ── QZ Tray 2.x handshake ─────────────────────────────────────────────
      // Server sends {"call":"websocket.connected","uid":"..."} first.
      // Client MUST acknowledge before sending any commands.
      if (!_connected && msg.call === "websocket.connected") {
        ws.send(JSON.stringify({ uid: msg.uid, call: "websocket.connected", result: null }));
        clearTimeout(timer);
        _connected = true;
        _ws = ws;
        _intentionalClose = false;
        _reconnectAttempts = 0;
        startKeepalive();
        resolve();
        return;
      }

      // Fallback: any message = connected (older QZ Tray versions)
      if (!_connected) {
        clearTimeout(timer);
        _connected = true;
        _ws = ws;
        _intentionalClose = false;
        _reconnectAttempts = 0;
        startKeepalive();
        resolve();
        return;
      }

      // ── Resolve pending RPC call ──────────────────────────────────────────
      if (msg.uid && _pending.has(msg.uid)) {
        const { resolve: res, reject: rej } = _pending.get(msg.uid)!;
        _pending.delete(msg.uid);
        if (msg.error) rej(new Error(msg.error));
        else res(msg.result);
        return;
      }

      // ── Catch-all: acknowledge any server-initiated message ───────────────
      // QZ Tray closes the connection if server-initiated calls (statusChanged,
      // printerAdded, etc.) go unacknowledged.
      if (msg.call && msg.uid) {
        ws.send(JSON.stringify({ uid: msg.uid, call: msg.call, result: null }));
      }
    };

    ws.onerror = () => {
      clearTimeout(timer);
      if (!_connected && preferSecure) {
        connectQZ(false).then(resolve).catch(() =>
          reject(new Error("QZ Tray no encontrado en localhost:8181 ni 8182."))
        );
      } else if (!_connected) {
        reject(new Error(
          "QZ Tray no encontrado. Asegurate que esté corriendo y que 'Block anonymous requests' esté desactivado."
        ));
      }
    };

    ws.onclose = () => {
      stopKeepalive();
      if (_ws === ws) { _connected = false; _ws = null; }

      // Auto-reconnect with exponential backoff (unless user disconnected intentionally)
      if (!_intentionalClose && _reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        _reconnectAttempts++;
        const delay = Math.min(2000 * Math.pow(2, _reconnectAttempts - 1), 30_000);
        _reconnectTimer = setTimeout(() => {
          connectQZ().catch(() => {}); // silent retry
        }, delay);
      }
    };
  });
}

// ── Internal RPC call ─────────────────────────────────────────────────────────
function call(callName: string, params: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!_ws || _ws.readyState !== WebSocket.OPEN) {
      reject(new Error("No conectado a QZ Tray")); return;
    }
    const id = Math.random().toString(36).slice(2, 10);
    _pending.set(id, { resolve, reject });
    _ws.send(JSON.stringify({ call: callName, uid: id, params }));

    setTimeout(() => {
      if (_pending.has(id)) {
        _pending.delete(id);
        reject(new Error("Timeout esperando respuesta de QZ Tray"));
      }
    }, CALL_TIMEOUT);
  });
}

// ── Public helpers ────────────────────────────────────────────────────────────

/** Returns list of printer names available on this PC */
export async function qzGetPrinters(): Promise<string[]> {
  await connectQZ();
  try {
    const result = await call("printers.find", {});
    if (Array.isArray(result)) return result as string[];
    if (typeof result === "string") return [result];
    return [];
  } catch {
    return [];
  }
}

/**
 * Sends ZPL content directly to the printer via RAW mode.
 * Printer must have a Generic / Text Only or ZPL driver.
 */
export async function qzPrintZPL(zplContent: string, printerName: string): Promise<void> {
  await connectQZ();
  await call("print", {
    printer: { name: printerName },
    data: [{
      type:    "raw",
      format:  "command",
      data:    zplContent,
      options: { language: "ZPL" },
    }],
  });
}
