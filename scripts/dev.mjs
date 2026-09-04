import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

for (const envFile of [".env", ".env.local"]) {
  if (existsSync(envFile)) {
    loadEnvFile(envFile);
  }
}

const env = { ...process.env };

if (!env.GAME_REALTIME_ENABLED) {
  env.GAME_REALTIME_ENABLED = "true";
}

const realtimeEnabled = env.GAME_REALTIME_ENABLED === "true";
const realtimePort = env.GAME_REALTIME_PORT?.trim() || "3001";

if (realtimeEnabled) {
  if (!env.NEXT_PUBLIC_GAME_REALTIME_MODE) {
    env.NEXT_PUBLIC_GAME_REALTIME_MODE = "hybrid";
  }
  if (!env.NEXT_PUBLIC_GAME_REALTIME_URL) {
    env.NEXT_PUBLIC_GAME_REALTIME_URL = `ws://localhost:${realtimePort}/realtime`;
  }
} else if (!env.NEXT_PUBLIC_GAME_REALTIME_MODE) {
  env.NEXT_PUBLIC_GAME_REALTIME_MODE = "off";
}

function runChecked(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`[war-brasil] falha ao ${label}:`, result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runChecked(
  process.execPath,
  [resolve("scripts/prepare-dev-db.mjs")],
  "preparar o banco de desenvolvimento",
);

if (realtimeEnabled) {
  const realtimeDependenciesReady =
    existsSync(resolve("realtime/node_modules/ws/package.json")) &&
    existsSync(resolve("realtime/node_modules/@redis/client/package.json"));

  if (!realtimeDependenciesReady) {
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    console.log("[war-brasil] instalando dependências do gateway realtime...");
    runChecked(
      npmCommand,
      ["--prefix", "realtime", "ci"],
      "instalar as dependências realtime",
    );
  }
}

const children = [];
let shuttingDown = false;

function start(name, script, args = []) {
  const child = spawn(process.execPath, [resolve(script), ...args], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });

  children.push({ name, child });

  child.on("error", (error) => {
    console.error(`[war-brasil] ${name} não iniciou:`, error.message);
    if (!shuttingDown) {
      process.exitCode = 1;
      shutdown("SIGTERM");
    }
  });

  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      const detail = signal ? `sinal ${signal}` : `código ${code ?? 1}`;
      console.error(`[war-brasil] ${name} encerrou inesperadamente (${detail}).`);
      process.exitCode = code && code > 0 ? code : 1;
      shutdown("SIGTERM");
      return;
    }

    if (children.every(({ child: running }) => running.exitCode !== null || running.signalCode !== null)) {
      process.exit(process.exitCode ?? 0);
    }
  });
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
  }
}

process.on("SIGINT", () => {
  process.exitCode = 0;
  shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  process.exitCode = 0;
  shutdown("SIGTERM");
});

console.log(
  realtimeEnabled
    ? `[war-brasil] dev: Next + realtime (${env.NEXT_PUBLIC_GAME_REALTIME_MODE}) em ws://localhost:${realtimePort}/realtime.`
    : "[war-brasil] dev: realtime explicitamente desativado; sinalizações de posse ficarão indisponíveis.",
);

start("Next.js", "node_modules/next/dist/bin/next", ["dev"]);
if (realtimeEnabled) {
  start("realtime gateway", "realtime/server.mjs");
}
