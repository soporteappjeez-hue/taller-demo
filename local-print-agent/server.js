/**
 * Local Print Agent — HTTP server for RAW ZPL printing via Windows Spooler.
 * Zero npm dependencies. Runs on Node.js built-in modules only.
 *
 * Endpoints:
 *   GET  /health   → { status: "ok", printer, version }
 *   POST /print    → { zpl, printer? } → sends RAW to spooler
 *   GET  /printers → list of installed Windows printers
 *   POST /purge    → clears print queue for target printer
 *
 * Usage:  node server.js
 * Port:   7070 (configurable via PRINT_AGENT_PORT env var)
 */

const http = require("http");
const { execSync, exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.PRINT_AGENT_PORT || "7070", 10);
const DEFAULT_PRINTER = "4BARCODE 4B-2054K";
const LOG_FILE = path.join(__dirname, "print-agent.log");
const MAX_LOG_LINES = 500;
const VERSION = "1.0.0";

// ── Logging ───────────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + "\n");
    // Rotate if too large
    const content = fs.readFileSync(LOG_FILE, "utf8");
    const lines = content.split("\n");
    if (lines.length > MAX_LOG_LINES) {
      fs.writeFileSync(LOG_FILE, lines.slice(-MAX_LOG_LINES).join("\n"));
    }
  } catch { /* ignore log errors */ }
}

// ── CORS headers ──────────────────────────────────────────────────────────────
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, data) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

// ── Get installed printers ────────────────────────────────────────────────────
function getInstalledPrinters() {
  try {
    const out = execSync(
      'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"',
      { encoding: "utf8", timeout: 5000 }
    );
    return out.split("\n").map(s => s.trim()).filter(Boolean);
  } catch {
    // Fallback to wmic
    try {
      const out = execSync("wmic printer get name /format:list", {
        encoding: "utf8", timeout: 5000,
      });
      return out.split("\n")
        .filter(l => l.startsWith("Name="))
        .map(l => l.replace("Name=", "").trim())
        .filter(Boolean);
    } catch { return []; }
  }
}

// ── ZPL paper size injection ──────────────────────────────────────────────────
function ensurePaperSize(zpl) {
  const hasWidth = /\^PW/i.test(zpl);
  const hasLength = /\^LL/i.test(zpl);
  if (hasWidth && hasLength) return zpl;
  // 203 dpi: 100mm = ~800 dots, 150mm = ~1200 dots
  const prefix = `^XA${!hasWidth ? "^PW800" : ""}${!hasLength ? "^LL1200" : ""}^XZ\n`;
  return prefix + zpl;
}

// ── RAW print via Win32 P/Invoke (winspool.drv) ──────────────────────────────
function printRaw(zplContent, printerName) {
  return new Promise((resolve, reject) => {
    const zpl = ensurePaperSize(zplContent);
    // Encode as Base64 to avoid quoting issues
    const b64 = Buffer.from(zpl, "utf8").toString("base64");

    // Write PowerShell script to a temp file (avoids escaping hell)
    const tmpPs1 = path.join(__dirname, "_print_job.ps1");
    const ps = `$ErrorActionPreference = 'Stop'

$code = @'
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DOCINFOW {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDatatype;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, ref DOCINFOW pDocInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    public static void SendRaw(string printerName, byte[] data) {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
            throw new Exception("No se pudo abrir la impresora: " + printerName + " (Error " + Marshal.GetLastWin32Error() + ")");

        var di = new DOCINFOW { pDocName = "ZPL Label", pDatatype = "RAW" };
        try {
            if (!StartDocPrinter(hPrinter, 1, ref di))
                throw new Exception("StartDocPrinter fallo (Error " + Marshal.GetLastWin32Error() + ")");
            if (!StartPagePrinter(hPrinter))
                throw new Exception("StartPagePrinter fallo");

            IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(data.Length);
            try {
                Marshal.Copy(data, 0, pUnmanagedBytes, data.Length);
                int written;
                if (!WritePrinter(hPrinter, pUnmanagedBytes, data.Length, out written))
                    throw new Exception("WritePrinter fallo (Error " + Marshal.GetLastWin32Error() + ")");
            } finally {
                Marshal.FreeCoTaskMem(pUnmanagedBytes);
            }

            EndPagePrinter(hPrinter);
            EndDocPrinter(hPrinter);
        } finally {
            ClosePrinter(hPrinter);
        }
    }
}
'@

try { Add-Type -TypeDefinition $code -Language CSharp } catch {}

$bytes = [System.Convert]::FromBase64String('${b64}')
[RawPrinterHelper]::SendRaw('${printerName.replace(/'/g, "''")}', $bytes)
Write-Output 'OK'
`;

    fs.writeFileSync(tmpPs1, ps, "utf8");

    exec(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpPs1}"`,
      { timeout: 15000 },
      (err, stdout, stderr) => {
        // Clean up temp file
        try { fs.unlinkSync(tmpPs1); } catch {}

        if (err) {
          const msg = (stderr || stdout || err.message).trim();
          log(`ERROR print: ${msg}`);
          reject(new Error(msg));
        } else {
          log(`OK: impreso en "${printerName}"`);
          resolve();
        }
      }
    );
  });
}

// ── Purge print queue ─────────────────────────────────────────────────────────
function purgeQueue(printerName) {
  return new Promise((resolve, reject) => {
    exec(
      `powershell -NoProfile -Command "Get-PrintJob -PrinterName '${printerName.replace(/'/g, "''")}' | Remove-PrintJob -ErrorAction SilentlyContinue"`,
      { timeout: 10000 },
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// ── Read request body ─────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { reject(new Error("JSON inválido")); }
    });
    req.on("error", reject);
  });
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];

  // CORS preflight
  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // GET /health
    if (url === "/health" && req.method === "GET") {
      const printers = getInstalledPrinters();
      const found = printers.some(p => p.toLowerCase().includes("4barcode"));
      json(res, 200, {
        status: "ok",
        printer: found ? DEFAULT_PRINTER : null,
        printers_count: printers.length,
        version: VERSION,
      });
      return;
    }

    // GET /printers
    if (url === "/printers" && req.method === "GET") {
      json(res, 200, { printers: getInstalledPrinters() });
      return;
    }

    // POST /print
    if (url === "/print" && req.method === "POST") {
      const body = await readBody(req);
      if (!body.zpl) {
        json(res, 400, { error: "Falta el campo 'zpl'" });
        return;
      }
      const printer = body.printer || DEFAULT_PRINTER;
      log(`Imprimiendo ${body.zpl.length} bytes en "${printer}"...`);
      // Debug: save last ZPL to file for inspection
      try { fs.writeFileSync(path.join(__dirname, "_last_zpl.txt"), body.zpl, "utf8"); } catch {}
      await printRaw(body.zpl, printer);
      json(res, 200, { status: "ok", printer, bytes: body.zpl.length });
      return;
    }

    // POST /purge
    if (url === "/purge" && req.method === "POST") {
      let printer = DEFAULT_PRINTER;
      try {
        const body = await readBody(req);
        if (body.printer) printer = body.printer;
      } catch { /* use default */ }
      log(`Purgando cola de "${printer}"...`);
      await purgeQueue(printer);
      json(res, 200, { status: "ok", printer });
      return;
    }

    // 404
    json(res, 404, { error: "Endpoint no encontrado" });

  } catch (err) {
    log(`ERROR: ${err.message}`);
    json(res, 500, { error: err.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  log(`=== Print Agent v${VERSION} escuchando en http://127.0.0.1:${PORT} ===`);

  // Check if target printer is installed
  const printers = getInstalledPrinters();
  const found = printers.find(p => p.toLowerCase().includes("4barcode"));
  if (found) {
    log(`Impresora encontrada: "${found}"`);
  } else {
    log(`ADVERTENCIA: No se encontro "${DEFAULT_PRINTER}" en las impresoras instaladas.`);
    log(`Impresoras disponibles: ${printers.join(", ") || "(ninguna)"}`);
  }
});
