import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";

await rm(".test-build", { recursive: true, force: true });

const child = spawn(
  process.execPath,
  ["./node_modules/typescript/bin/tsc", "-p", "tsconfig.test.json"],
  { stdio: "inherit" },
);

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`white-box compile terminated by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
