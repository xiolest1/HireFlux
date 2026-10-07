import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AWS_REGION,
  loadEnvironmentConfig,
  resolveEnvironment,
  validateEnvironmentConfig,
  validateSourceBranch,
} from '../lib/config/environment';
import { explicitResourceName, MAX_EXPLICIT_NAME_LENGTH } from '../lib/config/naming';

for (const environment of ['staging', 'production'] as const) {
  test(`${environment} resolves to an immutable canonical configuration`, () => {
    const config = loadEnvironmentConfig(environment);
    assert.equal(config.environmentName, environment);
    assert.equal(config.stackName, `hireflux-${environment}`);
    assert.equal(config.resourceNamePrefix, `hireflux-${environment}`);
    assert.equal(config.awsRegion, AWS_REGION);
    assert.equal(config.awsAccount, undefined);
    assert.deepEqual(config.tags, { Project: 'HireFlux', Environment: environment, ManagedBy: 'AWS-CDK' });
    assert.ok(Object.isFrozen(config) && Object.isFrozen(config.tags) && Object.isFrozen(config.data));
    assert.deepEqual(config.data, environment === 'production' ?
      { pointInTimeRecovery: true, deletionProtection: true, removalPolicy: 'RETAIN' } :
      { pointInTimeRecovery: false, deletionProtection: false, removalPolicy: 'DESTROY' });
  });
}

for (const value of [undefined, null, '', 'prod', 'stage', 'development', 'local', 'test', 'foo', ' staging', 'PRODUCTION', 1, {}]) {
  test(`rejects environment ${JSON.stringify(value)}`, () => {
    assert.throws(() => resolveEnvironment(value), /explicit environment/);
  });
}

test('environments have separate stack and resource identities', () => {
  const staging = loadEnvironmentConfig('staging');
  const production = loadEnvironmentConfig('production');
  assert.notEqual(staging.stackName, production.stackName);
  assert.notEqual(staging.resourceNamePrefix, production.resourceNamePrefix);
  assert.notEqual(staging.tags.Environment, production.tags.Environment);
  assert.equal(staging.tags.Project, production.tags.Project);
});

test('accounts can bind independently without credentials', () => {
  assert.equal(loadEnvironmentConfig('staging', '111111111111').awsAccount, '111111111111');
  assert.equal(loadEnvironmentConfig('production', '222222222222').awsAccount, '222222222222');
});

for (const value of ['', null, '123', '1234567890123', 'abcdefghijkl', 111111111111, '${AWS::AccountId}', ' 111111111111']) {
  test(`rejects malformed account ${JSON.stringify(value)}`, () => {
    assert.throws(() => loadEnvironmentConfig('staging', value), /12-digit string/);
  });
}

test('invalid configuration cannot cross the stack boundary', () => {
  const config = loadEnvironmentConfig('staging');
  for (const awsRegion of ['', 'us_east_1', 'US-EAST-1']) {
    assert.throws(() => validateEnvironmentConfig({ ...config, awsRegion }), /region identifier/);
  }
  assert.throws(() => validateEnvironmentConfig({ ...config, awsRegion: 'eu-west-1' }), /must use us-east-1/);
  for (const stackName of ['hireflux-production', '', 'HireFlux_staging']) {
    assert.throws(() => validateEnvironmentConfig({ ...config, stackName }), /Stack name/);
  }
  for (const resourceNamePrefix of ['hireflux-production', '', 'INVALID', 'x'.repeat(100)]) {
    assert.throws(() => validateEnvironmentConfig({ ...config, resourceNamePrefix }), /Resource name prefix/);
  }
  assert.throws(() => validateEnvironmentConfig({
    ...config, tags: { ...config.tags, Environment: 'production' },
  }), /Common tags/);
  const production = loadEnvironmentConfig('production');
  assert.throws(() => validateEnvironmentConfig({ ...production, stackName: config.stackName }), /Stack name/);
  assert.throws(() => validateEnvironmentConfig({ ...production, resourceNamePrefix: config.resourceNamePrefix }), /Resource name prefix/);
});

test('explicit physical names use the selected namespace and reject illegal/overlong values', () => {
  for (const environment of ['staging', 'production'] as const) {
    const config = loadEnvironmentConfig(environment);
    assert.equal(explicitResourceName(config, 'example'), `hireflux-${environment}-example`);
    const length = MAX_EXPLICIT_NAME_LENGTH - config.resourceNamePrefix.length - 1;
    assert.equal(explicitResourceName(config, 'x'.repeat(length)).length, MAX_EXPLICIT_NAME_LENGTH);
    assert.throws(() => explicitResourceName(config, 'x'.repeat(length + 1)), /must not exceed/);
    for (const suffix of ['', 'UPPER', '-example', 'example-', 'double--dash', 'under_score', 'with space', '1example']) {
      assert.throws(() => explicitResourceName(config, suffix), /suffix/);
    }
  }
});

test('data lifecycle cannot be cross-wired or weakened across environments', () => {
  const staging = loadEnvironmentConfig('staging');
  const production = loadEnvironmentConfig('production');
  assert.throws(() => validateEnvironmentConfig({ ...staging, data: production.data }), /DynamoDB lifecycle/);
  assert.throws(() => validateEnvironmentConfig({ ...production, data: staging.data }), /DynamoDB lifecycle/);
  for (const data of [
    { ...production.data, pointInTimeRecovery: false },
    { ...production.data, deletionProtection: false },
    { ...production.data, removalPolicy: 'DESTROY' as const },
  ]) assert.throws(() => validateEnvironmentConfig({ ...production, data }), /DynamoDB lifecycle/);
});


test('backend configuration rejects cross-environment auth, secret lifecycle and CORS drift', () => {
  const staging = loadEnvironmentConfig('staging');
  const production = loadEnvironmentConfig('production');
  assert.ok(Object.isFrozen(staging.backend) && Object.isFrozen(staging.backend.cors) && Object.isFrozen(staging.backend.cors.allowMethods));
  for (const backend of [production.backend, { ...staging.backend, authMode: 'cognito' as const },
    { ...staging.backend, secretRemovalPolicy: 'RETAIN' as const },
    { ...staging.backend, cors: { ...staging.backend.cors, allowOrigins: ['*'] } },
    { ...staging.backend, cors: { ...staging.backend.cors, allowOrigins: ['https://guessed.example.com'] } }]) {
    assert.throws(() => validateEnvironmentConfig({ ...staging, backend }), /Backend auth/);
  }
});

test('hosting configuration is explicit, frozen and cannot cross-wire environments or invent auth', () => {
  const staging = loadEnvironmentConfig('staging');
  const production = loadEnvironmentConfig('production');
  assert.ok(Object.isFrozen(staging.hosting));
  assert.deepEqual(staging.hosting, { repositoryUrl: 'https://github.com/xiolest1/HireFlux',
    sourceBranch: 'main', stage: 'BETA', autoBuild: true, appRoot: 'frontend', workspaceMode: 'demo' });
  assert.deepEqual(production.hosting, { ...staging.hosting, stage: 'PRODUCTION', autoBuild: false });
  for (const hosting of [production.hosting, { ...staging.hosting, repositoryUrl: 'https://github.com/other/repo' },
    { ...staging.hosting, sourceBranch: 'develop' }, { ...staging.hosting, workspaceMode: 'local' as any }]) {
    assert.throws(() => validateEnvironmentConfig({ ...staging, hosting }), /Hosting repository/);
  }
});

test('source branch validates exact DNS-label semantics without guessing Git branch transformations', () => {
  for (const value of ['main', 'staging', 'release-2']) assert.doesNotThrow(() => validateSourceBranch(value));
  for (const value of ['', 'feature/topic', 'Main', 'a.b', '-main', 'main-', 'a'.repeat(64), 'a_b']) {
    assert.throws(() => validateSourceBranch(value), /DNS-safe/);
  }
});
