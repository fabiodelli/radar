// Orchestratore: build standalone Next -> assembla dist-app/ -> impacchetta Radar.exe.
// Uso: npm run build:exe

import { spawnSync } from "node:child_process";
import { existsSync, rmSync, mkdirSync, cpSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const STANDALONE = path.join(ROOT, ".next", "standalone");
const DIST = path.join(ROOT, "dist-app");
const LAUNCHER = path.join(ROOT, "tools", "launcher", "radar.js");
const PKG_TARGET = "node22-win-x64";

function run(cmd, args) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const res = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: true });
  if (res.status !== 0) {
    console.error(`\nComando fallito: ${cmd} ${args.join(" ")}`);
    process.exit(res.status ?? 1);
  }
}

// 1. Build standalone.
run("npx", ["next", "build"]);

if (!existsSync(STANDALONE)) {
  console.error('\nManca .next/standalone — verifica che next.config abbia output: "standalone".');
  process.exit(1);
}

// 2. Copia gli asset che lo standalone non include da solo.
console.log("\n> Copia public/ e .next/static nello standalone");
const publicSrc = path.join(ROOT, "public");
if (existsSync(publicSrc)) {
  cpSync(publicSrc, path.join(STANDALONE, "public"), { recursive: true });
}
cpSync(path.join(ROOT, ".next", "static"), path.join(STANDALONE, ".next", "static"), {
  recursive: true,
});

// 3. Copia i segreti (restano sul PC di Fabio, non finiscono nell'exe).
const envSrc = path.join(ROOT, ".env.local");
if (existsSync(envSrc)) {
  copyFileSync(envSrc, path.join(STANDALONE, ".env.local"));
} else {
  console.warn("\nAttenzione: .env.local non trovato — l'app girerà senza chiavi API.");
}

// 4. Assembla dist-app/ e impacchetta il launcher.
console.log("\n> Preparo dist-app/");
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(STANDALONE, DIST, { recursive: true });

// Icona usata dalla scorciatoia sul desktop (Radar.lnk -> dist-app/radar.ico).
const iconSrc = path.join(ROOT, "src", "app", "favicon.ico");
if (existsSync(iconSrc)) {
  copyFileSync(iconSrc, path.join(DIST, "radar.ico"));
}

run("npx", ["@yao-pkg/pkg", LAUNCHER, "--targets", PKG_TARGET, "--output", path.join(DIST, "Radar.exe")]);

console.log(`\nFatto. Eseguibile pronto: ${path.join(DIST, "Radar.exe")}`);
console.log("Doppio click su Radar.exe per avviare Radar.");
