import { spawn } from "node:child_process";

const thresholdArg = process.argv.find((value) =>
  value.startsWith("--threshold="),
);
const threshold = thresholdArg
  ? Number.parseInt(thresholdArg.slice("--threshold=".length), 10)
  : null;

if (
  threshold !== null &&
  (!Number.isInteger(threshold) || threshold < 0 || threshold > 100)
) {
  console.error("threshold must be an integer between 0 and 100");
  process.exit(2);
}

const coverageIncludes = [
  ".test-build/shared/**/*.js",
  ".test-build/bots/**/*.js",
  ".test-build/events/**/*.js",
  ".test-build/client/map/**/*.js",
  ".test-build/client/dice/**/*.js",
  ".test-build/client/sync/**/*.js",
  ".test-build/client/operations/**/*.js",
];

const args = [
  "--test",
  "--experimental-test-coverage",
  "--test-timeout=20000",
  ...coverageIncludes.map(
    (pattern) => `--test-coverage-include=${pattern}`,
  ),
];

if (threshold !== null) {
  args.push(`--test-coverage-lines=${threshold}`);
}

args.push("tests/*.test.mjs", "tests/white-box/coverage-scope.test.mjs");

const child = spawn(process.execPath, args, {
  env: process.env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`white-box coverage runner terminated by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
