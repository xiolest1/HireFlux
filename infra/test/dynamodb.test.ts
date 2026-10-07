import { fixtureArtifact } from './fixture';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CfnTable } from 'aws-cdk-lib/aws-dynamodb';
import { loadEnvironmentConfig } from '../lib/config/environment';
import { HireFluxStack } from '../lib/hireflux-stack';

for (const environment of ['staging', 'production'] as const) {
  test(`${environment} has the exact single-region table schema and lifecycle`, () => {
    const config = loadEnvironmentConfig(environment);
    const stack = new HireFluxStack(new App(), `HireFlux-${environment}`, config, fixtureArtifact);
    const template = Template.fromStack(stack);
    const json = template.toJSON();
    const tables = template.findResources('AWS::DynamoDB::Table');
    assert.deepEqual(Object.keys(tables), ['WorkspaceTable68AC2584']);
    assert.equal(Object.keys(json.Resources).length, 13);
    assert.deepEqual(json.Outputs ?? {}, {});
    const table = tables.WorkspaceTable68AC2584;
    assert.ok(table);
    const properties = table.Properties;
    assert.deepEqual(properties.AttributeDefinitions, [
      'PK', 'SK', 'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK', 'GSI3PK', 'GSI3SK',
    ].map((AttributeName) => ({ AttributeName, AttributeType: 'S' })));
    assert.deepEqual(properties.KeySchema, [
      { AttributeName: 'PK', KeyType: 'HASH' }, { AttributeName: 'SK', KeyType: 'RANGE' },
    ]);
    assert.deepEqual(properties.GlobalSecondaryIndexes, ['GSI1', 'GSI2', 'GSI3'].map((IndexName) => ({
      IndexName,
      KeySchema: [
        { AttributeName: `${IndexName}PK`, KeyType: 'HASH' },
        { AttributeName: `${IndexName}SK`, KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    })));
    assert.deepEqual(properties.TimeToLiveSpecification, { AttributeName: 'expires_at', Enabled: true });
    assert.equal(properties.BillingMode, 'PAY_PER_REQUEST');
    assert.equal(properties.TableClass, 'STANDARD');
    // SSEEnabled=false selects AWS-owned encryption; it does not disable at-rest encryption.
    assert.deepEqual(properties.SSESpecification, { SSEEnabled: false });
    for (const name of [
      'TableName', 'ProvisionedThroughput', 'LocalSecondaryIndexes', 'StreamSpecification',
      'Replicas', 'ReplicationGroup', 'KinesisStreamSpecification', 'ResourcePolicy', 'ImportSourceSpecification',
      'OnDemandThroughput', 'WarmThroughput', 'ContributorInsightsSpecification',
    ]) assert.equal(properties[name], undefined, `Unexpected ${name}`);
    assert.deepEqual(properties.PointInTimeRecoverySpecification,
      { PointInTimeRecoveryEnabled: environment === 'production' });
    assert.equal(properties.DeletionProtectionEnabled, environment === 'production');
    assert.equal(table.DeletionPolicy, environment === 'production' ? 'Retain' : 'Delete');
    assert.equal(table.UpdateReplacePolicy, environment === 'production' ? 'Retain' : 'Delete');
    assert.deepEqual(properties.Tags, [
      { Key: 'Environment', Value: environment },
      { Key: 'ManagedBy', Value: 'AWS-CDK' }, { Key: 'Project', Value: 'HireFlux' },
    ]);
  });
}

test('stateful construct path and logical ID are fixed across environments', () => {
  for (const environment of ['staging', 'production'] as const) {
    const stack = new HireFluxStack(new App(), `HireFlux-${environment}`, loadEnvironmentConfig(environment), fixtureArtifact);
    assert.equal(stack.workspaceTable.node.id, 'WorkspaceTable');
    assert.equal(stack.workspaceTable.node.path, `HireFlux-${environment}/WorkspaceTable`);
    const resource = stack.workspaceTable.node.defaultChild;
    assert.ok(resource instanceof CfnTable);
    assert.equal(stack.getLogicalId(resource), 'WorkspaceTable68AC2584');
    assert.deepEqual(stack.resolve(stack.workspaceTable.tableName), { Ref: 'WorkspaceTable68AC2584' });
  }
});

test('each environment owns a separate table without a shared physical name or cross-stack reference', () => {
  const app = new App();
  const staging = new HireFluxStack(app, 'HireFlux-staging', loadEnvironmentConfig('staging', '111111111111'), fixtureArtifact);
  const production = new HireFluxStack(app, 'HireFlux-production', loadEnvironmentConfig('production', '222222222222'), fixtureArtifact);
  assert.notEqual(staging.stackName, production.stackName);
  assert.notEqual(staging.account, production.account);
  assert.notEqual(staging.workspaceTable, production.workspaceTable);
  assert.notEqual(staging.workspaceTable.tableName, production.workspaceTable.tableName);
  assert.equal(staging.workspaceTable.stack, staging);
  assert.equal(production.workspaceTable.stack, production);
  for (const stack of [staging, production]) {
    const template = Template.fromStack(stack).toJSON();
    assert.deepEqual(template.Outputs ?? {}, {});
    assert.ok(!JSON.stringify(template).includes('Fn::ImportValue'));
    assert.equal(template.Resources.WorkspaceTable68AC2584.Properties.TableName, undefined);
  }
});
