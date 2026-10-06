import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const require = createRequire(import.meta.url);
const { AWS_REGION } = require('../build/lib/config/environment.js');
if (!['synth', 'synthesize', 'ls', 'list', '--version'].includes(args[0])) {
  throw new Error('Phase 3A permits local CDK synth, list, or --version only.');
}
if (args.some((arg) => arg === '--profile' || arg.startsWith('--profile='))) {
  throw new Error('Local CDK commands do not accept AWS profiles. Use explicit account context.');
}

// The CLI can resolve its default account before executing the app. Isolate every
// local invocation from credentials, profiles, container credentials, and IMDS.
const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/^(AWS_|CDK_DEFAULT_)/i.test(key)) delete env[key];
}
const scratch = mkdtempSync(join(tmpdir(), 'hireflux-cdk-local-'));
try {
  const configFile = join(scratch, 'config');
  const credentialsFile = join(scratch, 'credentials');
  writeFileSync(configFile, '');
  writeFileSync(credentialsFile, '');
  env.AWS_CONFIG_FILE = configFile;
  env.AWS_SHARED_CREDENTIALS_FILE = credentialsFile;
  env.AWS_EC2_METADATA_DISABLED = 'true';
  // CDK also probes IMDS for a region when none is supplied, independently of
  // the SDK credential-chain switch above. Supply our reviewed canonical region.
  env.AWS_REGION = AWS_REGION;
  env.CDK_DISABLE_CLI_TELEMETRY = 'true';
  const cli = require.resolve('aws-cdk/bin/cdk');
  const result = spawnSync(process.execPath, [cli, ...args, '--no-lookups', '--no-notices'], {
    cwd: new URL('..', import.meta.url),
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
