import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { verifyHostedBuild, verifyPublicationBuild, verifyHostedBuildFixture } from "./verify-hosted-build.mjs";
import { reviewedPublicDeployments } from "../src/publicDeploymentPolicy.mjs";

const publicConfig = { apiBaseUrl: "https://phase3e-example.execute-api.us-east-1.amazonaws.com",
  siteUrl: "https://main.phase3e-example.amplifyapp.com", workspaceMode: "demo" };

const fictionalProduction = {
  environment: "production", siteOrigin: "https://fictional-production.example.com", apiOrigin: "https://fictional-api.example.com",
  capabilities: ["demo", "cognito"], cognito: { issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_FICTIONAL",
    clientId: "FICTIONALPUBLICCLIENT", domain: "https://fictional-provider.auth.us-east-1.amazoncognito.com" },
  callbackUrl: "https://fictional-production.example.com/auth/callback", logoutUrl: "https://fictional-production.example.com/auth/signed-out", selfRegistrationEnabled: false,
};

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

test("normal production publication is blocked by unbound target/root authority without a fixture escape", async () => {
  await fixture(async (directory) => {
    assert.equal(reviewedPublicDeployments.production, null);
    await assert.rejects(verifyPublicationBuild(directory, { ...publicConfig, environment: "production" }), /root-header migration|unbound/);
    await assert.rejects(verifyPublicationBuild(directory, { ...publicConfig, environment: "staging" }), /unbound or mismatched/);
  });
});

test("isolated fictional production artifact checks provider and rejects staging identity or missing metadata", async () => {
  await fixture(async (directory) => {
    const options = { apiBaseUrl: fictionalProduction.apiOrigin, siteUrl: fictionalProduction.siteOrigin, workspaceMode: "demo", environment: "production" };
    const bindings = { staging: reviewedPublicDeployments.staging, production: fictionalProduction };
    await writeFile(path.join(directory, "index.html"), `<title>Fictional production fixture</title>${options.siteUrl}`);
    const body = JSON.stringify([options.apiBaseUrl, options.siteUrl, ...Object.values(fictionalProduction.cognito)]);
    await writeFile(path.join(directory, "assets/app.js"), body);
    assert.equal((await verifyHostedBuildFixture(directory, options, bindings)).publishable, false);
    await writeFile(path.join(directory, "assets/app.js"), body + reviewedPublicDeployments.staging.apiOrigin);
    await assert.rejects(verifyHostedBuildFixture(directory, options, bindings), /contains staging identity/);
    await writeFile(path.join(directory, "assets/app.js"), JSON.stringify([options.apiBaseUrl, options.siteUrl]));
    await assert.rejects(verifyHostedBuildFixture(directory, options, bindings), /provider metadata missing/);
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
