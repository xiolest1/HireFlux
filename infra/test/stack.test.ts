import { fixtureArtifact } from './fixture';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { App, CfnParameter, Token } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { composeEnvironment } from '../lib/app';
import { loadEnvironmentConfig } from '../lib/config/environment';
import { HireFluxStack } from '../lib/hireflux-stack';

for (const environment of ['staging', 'production'] as const) {
  test(`${environment} composes one table stack with correct assembly identity and tags`, () => {
    const outdir = mkdtempSync(join(tmpdir(), 'hireflux-stack-test-'));
    try {
      const app = new App({ outdir, analyticsReporting: false, context: { environment } });
      const stack = composeEnvironment(app, fixtureArtifact);
      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::DynamoDB::Table', 1);
      assert.equal(Object.keys(template.toJSON().Resources).length, 13);
      const assembly = app.synth();
      assert.equal(assembly.stacks.length, 1);
      assert.equal(assembly.manifest.missing, undefined);
      const artifact = assembly.getStackArtifact(stack.artifactId);
      assert.equal(artifact.stackName, `hireflux-${environment}`);
      assert.equal(stack.node.id, `HireFlux-${environment}`);
      assert.equal(artifact.environment.region, 'us-east-1');
      assert.equal(artifact.environment.account, 'unknown-account');
      assert.deepEqual(artifact.tags, { Project: 'HireFlux', Environment: environment, ManagedBy: 'AWS-CDK' });
      assert.equal(Object.keys(artifact.template.Resources).length, 13);
      assert.deepEqual(artifact.template.Metadata.HireFlux, {
        environmentName: environment,
        resourceNamePrefix: `hireflux-${environment}`,
        awsRegion: 'us-east-1',
        accountBinding: 'unbound',
      });
      assert.deepEqual(artifact.template.Outputs ?? {}, {});
      assert.ok(Token.isUnresolved(stack.account));
    } finally {
      rmSync(outdir, { recursive: true, force: true });
    }
  });
}

test('explicit account binding selects only the requested environment account', () => {
  const app = new App({ analyticsReporting: false, context: {
    environment: 'production', stagingAccount: '111111111111', productionAccount: '222222222222',
  } });
  const stack = composeEnvironment(app, fixtureArtifact);
  assert.equal(stack.account, '222222222222');
  assert.equal(stack.region, 'us-east-1');
});

test('composition rejects missing/invalid selection and malformed selected binding', () => {
  assert.throws(() => composeEnvironment(new App()), /explicit environment/);
  assert.throws(() => composeEnvironment(new App({ context: { environment: 'prod' } })), /explicit environment/);
  assert.throws(() => composeEnvironment(new App({ context: { environment: 'staging', stagingAccount: '' } }), fixtureArtifact), /12-digit/);
});

test('stack validates configuration before creating a construct', () => {
  const app = new App();
  const config = loadEnvironmentConfig('staging');
  assert.throws(() => new HireFluxStack(app, 'Invalid', { ...config, stackName: 'hireflux-production' }), /Stack name/);
  assert.equal(app.node.children.length, 0);
});

test('stable construct paths control logical IDs independently of physical stack names', () => {
  const staging = new HireFluxStack(new App(), 'HireFlux-staging', loadEnvironmentConfig('staging'), fixtureArtifact);
  const production = new HireFluxStack(new App(), 'HireFlux-production', loadEnvironmentConfig('production'), fixtureArtifact);
  // Parameters demonstrate CDK logical identity without inventing an AWS resource.
  const stagingParameter = new CfnParameter(staging, 'StableContract', { type: 'String' });
  const productionParameter = new CfnParameter(production, 'StableContract', { type: 'String' });
  assert.equal(stagingParameter.node.id, 'StableContract');
  assert.equal(staging.getLogicalId(stagingParameter), production.getLogicalId(productionParameter));
  assert.notEqual(staging.stackName, production.stackName);
});
