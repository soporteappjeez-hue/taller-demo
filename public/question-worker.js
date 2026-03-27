// Web Worker: ejecuta el polling cada 5 minutos
// No se ve afectado por throttling de pestañas en segundo plano
let timer = null;

self.onmessage = function(e) {
  if (e.data === "start") {
    if (timer) clearInterval(timer);
    timer = setInterval(function() {
      self.postMessage("tick");
    }, 300000); // 5 minutos
  } else if (e.data === "stop") {
    if (timer) clearInterval(timer);
    timer = null;
  }
};
