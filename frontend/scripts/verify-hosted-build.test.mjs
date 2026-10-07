import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { verifyHostedBuild } from "./verify-hosted-build.mjs";

const publicConfig = { apiBaseUrl: "https://phase3e-example.execute-api.us-east-1.amazonaws.com",
  siteUrl: "https://main.phase3e-example.amplifyapp.com", workspaceMode: "demo" };

async function fixture(run) {
  const directory = await mkdtemp(path.join(tmpdir(), "hireflux-hosted-build-"));
  try {
    await mkdir(path.join(directory, "assets"));
    await writeFile(path.join(directory, "index.html"), `<meta property="og:url" content="${publicConfig.siteUrl}">`);
    await writeFile(path.join(directory, "assets/app.js"), `const endpoint = "${publicConfig.apiBaseUrl}";`);
    await run(directory);
  } finally {
    const relative = path.relative(path.resolve(tmpdir()), path.resolve(directory));
    assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
    await rm(directory, { recursive: true, force: true });
  }
}

test("deployment artifact requires explicit public API/site URLs and the existing demo mode", async () => {
  await fixture(async (directory) => {
    assert.deepEqual(await verifyHostedBuild(directory, publicConfig), {
      file_count: 2, source_maps: false, public_urls_present: true, private_material_and_local_endpoints: "absent",
    });
    for (const config of [{ ...publicConfig, apiBaseUrl: "http://localhost:8000" },
      { ...publicConfig, workspaceMode: "local" }, { ...publicConfig, siteUrl: "https://staging.invalid" }]) {
      await assert.rejects(verifyHostedBuild(directory, config));
    }
  });
});

test("local endpoints, synthetic secret material and unresolved Vite placeholders fail without dumping bundles", async () => {
  await fixture(async (directory) => {
    for (const content of ['fetch("http://localhost:8000")', 'fetch("http://127.0.0.1:8000")',
      'AWS_SECRET_ACCESS_KEY=synthetic-private', '%VITE_API_BASE_URL%']) {
      await writeFile(path.join(directory, "assets/leak.js"), content);
      await assert.rejects(verifyHostedBuild(directory, publicConfig), /Forbidden material/);
    }
  });
});

test("private config files and source maps cannot be silently shipped", async () => {
  for (const name of [".env", "credentials", "assets/app.js.map"]) {
    await fixture(async (directory) => {
      await writeFile(path.join(directory, name), "synthetic fixture");
      await assert.rejects(verifyHostedBuild(directory, publicConfig), /Private configuration/);
    });
  }
});

test("a stale build cannot pass if its endpoint differs from branch configuration", async () => {
  await fixture(async (directory) => {
    await assert.rejects(verifyHostedBuild(directory, {
      ...publicConfig, apiBaseUrl: "https://other-example.execute-api.us-east-1.amazonaws.com",
    }), /Expected public API URL missing/);
  });
});
