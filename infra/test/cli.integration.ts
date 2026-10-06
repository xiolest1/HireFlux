import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { CloudAssembly } from 'aws-cdk-lib/cx-api';

const packageRoot = resolve(__dirname, '../..');

function runLocal(args: readonly string[], auditPath: string) {
  return spawnSync(process.execPath, ['scripts/cdk-local.mjs', ...args], {
    cwd: packageRoot,
    timeout: 30_000,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_OPTIONS: `--require="${join(__dirname, 'block-network.js').replaceAll('\\', '/')}"`,
      HIREFLUX_NETWORK_AUDIT_PATH: auditPath,
      // These deliberately invalid inputs must never become credential/profile discovery.
      AWS_ACCESS_KEY_ID: 'offline-test-invalid-access-key',
      AWS_SECRET_ACCESS_KEY: 'offline-test-invalid-secret',
      AWS_PROFILE: 'offline-test-nonexistent-profile',
      CDK_DEFAULT_ACCOUNT: '333333333333',
      CDK_DEFAULT_REGION: 'eu-west-1',
    },
  });
}

for (const environment of ['staging', 'production'] as const) {
  test(`${environment} CLI synthesis is offline, verified-artifact backend, and repeatable`, () => {
    const scratch = mkdtempSync(join(tmpdir(), 'hireflux-cli-test-'));
    const auditPath = join(scratch, 'network-attempts');
    try {
      const templates: string[] = [];
      for (const iteration of ['first', 'second']) {
        const outdir = join(scratch, iteration);
        const result = runLocal(['synth', '-c', `environment=${environment}`, '--output', outdir], auditPath);
        assert.equal(result.status, 0, `${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`);
        assert.equal(existsSync(auditPath), false,
          existsSync(auditPath) ? readFileSync(auditPath, 'utf8') : 'No network attempts expected.');
        const template = readFileSync(join(outdir, `HireFlux-${environment}.template.json`), 'utf8');
        const parsed = JSON.parse(template);
        assert.equal(Object.keys(parsed.Resources).length, 11);
        assert.deepEqual(Object.values(parsed.Resources).map((resource: unknown) =>
          (resource as { Type: string }).Type), ['AWS::DynamoDB::Table', 'AWS::SecretsManager::Secret', 'AWS::SecretsManager::Secret', 'AWS::IAM::Role', 'AWS::IAM::Policy', 'AWS::Lambda::Function', 'AWS::ApiGatewayV2::Api', 'AWS::ApiGatewayV2::Integration', 'AWS::Lambda::Permission', 'AWS::ApiGatewayV2::Route', 'AWS::ApiGatewayV2::Stage']);
        assert.deepEqual(parsed.Outputs ?? {}, {});
        templates.push(template);
        const accepted = JSON.parse(readFileSync(join(packageRoot, '../artifacts/lambda/hireflux-backend-lambda.manifest.json'), 'utf8'));
        const assets = JSON.parse(readFileSync(join(outdir, `HireFlux-${environment}.assets.json`), 'utf8'));
        const files = Object.values(assets.files) as { source: { path: string; packaging: string } }[];
        assert.equal(files.length, 2); // The verified ZIP and the CloudFormation template.
        const zipped = files.filter((file) => file.source.path.endsWith('.zip'));
        assert.equal(zipped.length, 1);
        assert.equal(zipped[0]!.source.packaging, 'file');
        const staged = readFileSync(join(outdir, zipped[0]!.source.path));
        assert.equal(createHash('sha256').update(staged).digest('hex'), accepted.sha256);
        assert.equal(staged.length, accepted.compressed_bytes);
        const manifest: unknown = JSON.parse(readFileSync(join(outdir, 'manifest.json'), 'utf8'));
        assert.ok(typeof manifest === 'object' && manifest !== null && !('missing' in manifest));
      }
      assert.equal(templates[0], templates[1]);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
}

test('explicit environment accounts synthesize independently without credential discovery', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'hireflux-cli-binding-'));
  const auditPath = join(scratch, 'network-attempts');
  try {
    for (const [environment, account] of [['staging', '111111111111'], ['production', '222222222222']] as const) {
      const outdir = join(scratch, environment);
      const result = runLocal([
        'synth', '-c', `environment=${environment}`,
        '-c', 'stagingAccount=111111111111', '-c', 'productionAccount=222222222222',
        '--output', outdir,
      ], auditPath);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert.equal(existsSync(auditPath), false);
      const artifact = new CloudAssembly(outdir).getStackArtifact(`HireFlux-${environment}`);
      assert.equal(artifact.environment.account, account);
      assert.equal(artifact.environment.region, 'us-east-1');
      assert.equal(Object.keys(artifact.template.Resources).length, 11);
      assert.deepEqual(Object.values(artifact.template.Resources).map((resource: unknown) =>
        (resource as { Type: string }).Type), ['AWS::DynamoDB::Table', 'AWS::SecretsManager::Secret', 'AWS::SecretsManager::Secret', 'AWS::IAM::Role', 'AWS::IAM::Policy', 'AWS::Lambda::Function', 'AWS::ApiGatewayV2::Api', 'AWS::ApiGatewayV2::Integration', 'AWS::Lambda::Permission', 'AWS::ApiGatewayV2::Route', 'AWS::ApiGatewayV2::Stage']);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('local wrapper and app reject invalid selection, profile use, and mutation commands', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'hireflux-cli-invalid-'));
  const auditPath = join(scratch, 'network-attempts');
  try {
    const cases: readonly (readonly [readonly string[], RegExp])[] = [
      [['synth', '--output', join(scratch, 'missing')], /explicit environment/],
      [['synth', '-c', 'environment=prod', '--output', join(scratch, 'invalid')], /explicit environment/],
      [['synth', '-c', 'environment=staging', '-c', 'stagingAccount=123', '--output', join(scratch, 'account')], /12-digit string/],
      [['synth', '-c', 'environment=staging', '--profile', 'unused'], /do not accept AWS profiles/],
      [['deploy'], /local CDK synth/],
      [['bootstrap'], /local CDK synth/],
      [['destroy'], /local CDK synth/],
    ];
    for (const [args, expected] of cases) {
      const result = runLocal(args, auditPath);
      assert.notEqual(result.status, 0, `Unexpected success: ${args.join(' ')}`);
      assert.match(result.stderr, expected);
      assert.equal(existsSync(auditPath), false);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});


