// Local browser fixture only; the Playwright suite intercepts all provider/API requests.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.dirname(frontend);
const phase5d = process.env.HIREFLUX_AUTH_FIXTURE_PHASE === "5D";
const port = phase5d ? "4176" : "4175";
const output = path.resolve(root, `.tools/${phase5d ? "phase5d" : "phase5c"}-auth-browser/dist`);
const relative = path.relative(root, output);
assert.ok(relative.startsWith(`.tools${path.sep}`) && !relative.startsWith("..") && !path.isAbsolute(relative));
const vite = path.join(frontend, "node_modules/vite/bin/vite.js");
const env = { ...process.env,
  VITE_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`, VITE_API_BASE_URL: "http://localhost:8000",
  VITE_WORKSPACE_MODE: "demo",
};

function run(args) {
  const child = spawn(process.execPath, [vite, ...args], { cwd: frontend, env, stdio: "inherit", windowsHide: true });
  for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => child.kill(signal));
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`Local fixture process stopped (${code ?? signal}).`)));
  });
}

await run(["build", "--outDir", output, "--emptyOutDir"]);
await run(["preview", "--host", "127.0.0.1", "--port", port, "--strictPort", "--outDir", output]);
