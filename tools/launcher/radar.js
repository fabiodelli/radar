// Radar launcher — impacchettato in Radar.exe con @yao-pkg/pkg.
//
// L'exe fa da guscio cliccabile: avvia il server Next standalone (server.js, su disco
// accanto all'exe) come processo figlio usando il Node di sistema, aspetta che la porta
// risponda e apre Radar nel browser predefinito.
//
// Nota: il server gira sul Node di sistema (non sul Node embeddato in pkg) perché il
// server standalone di Next richiede il modulo `inspector`, disabilitato nei binari pkg.
// Finché questa finestra resta aperta il server resta vivo; chiudendola si ferma tutto.

"use strict";

const path = require("path");
const fs = require("fs");
const net = require("net");
const { spawn } = require("child_process");

// Cartella in cui vive l'exe (e quindi server.js / .next / .env.local).
// Con pkg, process.execPath è il path reale di Radar.exe su disco.
const BASE_DIR = path.dirname(process.execPath);
const SERVER_JS = path.join(BASE_DIR, "server.js");
const HOSTNAME = "127.0.0.1";
const FIRST_PORT = 3000;
const MAX_PORT_TRIES = 20;

function log(msg) {
  process.stdout.write(`[Radar] ${msg}\n`);
}

// Individua l'eseguibile Node di sistema (PATH o percorso di installazione tipico).
function resolveNode() {
  const fallbacks = [
    path.join(process.env.ProgramFiles || "C:\\Program Files", "nodejs", "node.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "nodejs", "node.exe"),
  ];
  for (const p of fallbacks) {
    if (fs.existsSync(p)) return p;
  }
  // Ultima spiaggia: affidati al PATH.
  return "node";
}

// Verifica se una porta è libera provando ad ascoltarci sopra.
function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => tester.close(() => resolve(true)))
      .listen(port, HOSTNAME);
  });
}

async function pickPort() {
  for (let i = 0; i < MAX_PORT_TRIES; i++) {
    const port = FIRST_PORT + i;
    if (await isPortFree(port)) return port;
  }
  throw new Error(`Nessuna porta libera tra ${FIRST_PORT} e ${FIRST_PORT + MAX_PORT_TRIES}`);
}

// Aspetta che il server risponda (connessione TCP riuscita).
function waitForServer(port, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const sock = net.connect(port, HOSTNAME);
      sock.once("connect", () => {
        sock.destroy();
        resolve();
      });
      sock.once("error", () => {
        sock.destroy();
        if (Date.now() > deadline) reject(new Error("Timeout avvio server"));
        else setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

function openBrowser(url) {
  // Windows: `cmd /c start "" <url>` apre il browser predefinito.
  spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
}

async function main() {
  if (!fs.existsSync(SERVER_JS)) {
    log(`server.js non trovato in ${BASE_DIR}. Rigenera con: npm run build:exe`);
    process.exit(1);
  }

  const port = await pickPort();
  const node = resolveNode();

  log(`Avvio server su http://${HOSTNAME}:${port} ...`);
  // server.js legge PORT/HOSTNAME e i file .env dalla sua cartella (cwd = BASE_DIR).
  const child = spawn(node, [SERVER_JS], {
    cwd: BASE_DIR,
    env: { ...process.env, PORT: String(port), HOSTNAME },
    stdio: "inherit",
  });

  // Lega il ciclo di vita: se il server muore, esce anche il launcher e viceversa.
  child.on("exit", (code) => {
    log(`Server terminato (code ${code}).`);
    process.exit(code ?? 0);
  });
  const killChild = () => {
    if (!child.killed) {
      try {
        spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
      } catch {}
    }
  };
  process.on("exit", killChild);
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));

  try {
    await waitForServer(port);
    const url = `http://${HOSTNAME}:${port}`;
    log(`Radar pronto: ${url}`);
    openBrowser(url);
    log("Lascia questa finestra aperta mentre usi Radar. Chiudila per fermarlo.");
  } catch (err) {
    log(`Errore: ${err.message}`);
    killChild();
    process.exit(1);
  }
}

main().catch((err) => {
  log(`Errore fatale: ${err.message}`);
  process.exit(1);
});
