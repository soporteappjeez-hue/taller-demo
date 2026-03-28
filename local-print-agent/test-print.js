// Quick test: send ZPL to the local print agent
const http = require("http");

const zpl = "^XA^FO50,50^A0N,50,50^FDPrueba MaqJeez^FS^FO50,120^A0N,30,30^FD4BARCODE OK^FS^XZ";
const body = JSON.stringify({ zpl });

const req = http.request({
  hostname: "127.0.0.1",
  port: 7070,
  path: "/print",
  method: "POST",
  headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
}, (res) => {
  let data = "";
  res.on("data", c => data += c);
  res.on("end", () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${data}`);
  });
});

req.on("error", e => console.error("Error:", e.message));
req.write(body);
req.end();
