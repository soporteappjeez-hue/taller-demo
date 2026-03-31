// Test: download a ZPL label from Vercel and check if it's decompressed
const https = require("https");

const url = "https://taller-motos-app-production.up.railway.app/api/meli-labels?action=download&format=zpl&ids=2000015732011282";

https.get(url, (res) => {
  const chunks = [];
  res.on("data", c => chunks.push(c));
  res.on("end", () => {
    const buf = Buffer.concat(chunks);
    console.log("Status:", res.statusCode);
    console.log("Size:", buf.length, "bytes");
    console.log("First 4 bytes (hex):", buf[0]?.toString(16), buf[1]?.toString(16), buf[2]?.toString(16), buf[3]?.toString(16));
    
    if (buf[0] === 0x50 && buf[1] === 0x4B) {
      console.log("STILL A ZIP! Backend did NOT decompress.");
    } else {
      console.log("NOT a ZIP - looks like text ZPL!");
      console.log("First 300 chars:", buf.toString("utf8").substring(0, 300));
    }
  });
}).on("error", e => console.error("Error:", e.message));
