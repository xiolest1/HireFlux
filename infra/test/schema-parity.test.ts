import assert from 'node:assert/strict';
import { test } from 'node:test';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { composeEnvironment } from '../lib/app';
import { assertSchemaParity } from '../lib/data/schema-parity';

function cloudSchema() {
  const stack = composeEnvironment(new App({ context: { environment: 'staging' } }));
  const table = Template.fromStack(stack).findResources('AWS::DynamoDB::Table').WorkspaceTable68AC2584;
  assert.ok(table);
  return table.Properties;
}

// Comparator tests inject drift. The separate CLI compares a fresh Python export
// against actual CDK synthesis; these fixtures are not the cross-language proof.
const mutations: readonly [string, (schema: ReturnType<typeof cloudSchema>) => void][] = [
  ['primary key name', (schema) => { schema.KeySchema[0].AttributeName = 'OTHER_PK'; }],
  ['primary sort key name', (schema) => { schema.KeySchema[1].AttributeName = 'OTHER_SK'; }],
  ['primary scalar type', (schema) => { schema.AttributeDefinitions[0].AttributeType = 'N'; }],
  ['index sort key', (schema) => { schema.GlobalSecondaryIndexes[1].KeySchema[1].AttributeName = 'GSI2_SORT'; }],
  ['index scalar type', (schema) => { schema.AttributeDefinitions[4].AttributeType = 'N'; }],
  ['omitted GSI3', (schema) => { schema.GlobalSecondaryIndexes.pop(); }],
  ['extra GSI', (schema) => { schema.GlobalSecondaryIndexes.push({ ...schema.GlobalSecondaryIndexes[0], IndexName: 'GSI4' }); }],
  ['index name', (schema) => { schema.GlobalSecondaryIndexes[0].IndexName = 'OWNER_INDEX'; }],
  ['projection change', (schema) => { schema.GlobalSecondaryIndexes[0].Projection.ProjectionType = 'KEYS_ONLY'; }],
  ['TTL name', (schema) => { schema.TimeToLiveSpecification.AttributeName = 'expiration'; }],
  ['TTL disabled', (schema) => { schema.TimeToLiveSpecification.Enabled = false; }],
  ['billing mode', (schema) => { schema.BillingMode = 'PROVISIONED'; }],
  ['extra attribute', (schema) => { schema.AttributeDefinitions.push({ AttributeName: 'expires_at', AttributeType: 'N' }); }],
  ['extra LSI', (schema) => { schema.LocalSecondaryIndexes = []; }],
  ['duplicate index', (schema) => { schema.GlobalSecondaryIndexes.push(schema.GlobalSecondaryIndexes[0]); }],
];

for (const [name, mutate] of mutations) {
  test(`schema parity detects ${name} drift`, () => {
    const schema = cloudSchema();
    const contract = { schema_version: 1, table_schema: structuredClone(schema) };
    mutate(schema);
    assert.throws(() => assertSchemaParity(contract, schema));
  });
}

test('schema parity ignores array order and lifecycle-only properties', () => {
  const schema = cloudSchema();
  const contract = { schema_version: 1, table_schema: structuredClone(schema) };
  schema.AttributeDefinitions.reverse();
  schema.KeySchema.reverse();
  schema.GlobalSecondaryIndexes.reverse();
  for (const index of schema.GlobalSecondaryIndexes) index.KeySchema.reverse();
  schema.PointInTimeRecoverySpecification.PointInTimeRecoveryEnabled = true;
  assertSchemaParity(contract, schema);
});

test('schema parity compares INCLUDE projections and their exact attribute sets', () => {
  const schema = cloudSchema();
  schema.GlobalSecondaryIndexes[0].Projection = { ProjectionType: 'INCLUDE', NonKeyAttributes: ['status', 'updated_at'] };
  const contract = { schema_version: 1, table_schema: structuredClone(schema) };
  schema.GlobalSecondaryIndexes[0].Projection.NonKeyAttributes.reverse();
  assertSchemaParity(contract, schema);
  schema.GlobalSecondaryIndexes[0].Projection.NonKeyAttributes.pop();
  assert.throws(() => assertSchemaParity(contract, schema));
  schema.GlobalSecondaryIndexes[0].Projection = { ProjectionType: 'ALL' };
  assert.throws(() => assertSchemaParity(contract, schema));
});

test('schema parity refuses malformed or unsupported backend exports', () => {
  const schema = cloudSchema();
  for (const contract of [null, [], { schema_version: 2, table_schema: schema }, { schema_version: 1 }]) {
    assert.throws(() => assertSchemaParity(contract, schema));
  }
});
