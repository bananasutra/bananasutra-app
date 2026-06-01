import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const packageJsonPath = resolve(process.cwd(), "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const scripts = packageJson?.scripts ?? {};

const requiredScripts = ["typecheck", "test:prompt", "test:bbb"];
const missing = requiredScripts.filter((name) => typeof scripts[name] !== "string" || scripts[name].trim().length === 0);

if (missing.length > 0) {
  console.error(`Missing required npm scripts in bbb-api/package.json: ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`Required npm scripts verified: ${requiredScripts.join(", ")}`);
