import assert from 'node:assert/strict';

function object(value: unknown, label: string): Record<string, unknown> {
  assert.ok(typeof value === 'object' && value !== null && !Array.isArray(value), `Invalid ${label}`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  assert.ok(typeof value === 'string' && value.length > 0, `Invalid ${label}`);
  return value;
}

function array(value: unknown, label: string): unknown[] {
  assert.ok(Array.isArray(value), `Invalid ${label}`);
  return value;
}

function unique(values: readonly string[], label: string): void {
  assert.equal(new Set(values).size, values.length, `Duplicate ${label}`);
}

function keys(value: unknown) {
  const entries = array(value, 'key schema').map((entry) => {
    const key = object(entry, 'key');
    const name = text(key.AttributeName, 'key name');
    const role = text(key.KeyType, 'key role');
    assert.ok(role === 'HASH' || role === 'RANGE', 'Invalid key role');
    return { name, role };
  }).sort((a, b) => a.role < b.role ? -1 : a.role > b.role ? 1 : 0);
  assert.deepEqual(entries.map((entry) => entry.role), ['HASH', 'RANGE']);
  unique(entries.map((entry) => entry.name), 'key names');
  return entries;
}

/** Normalize only the physical contract, independent of array order and lifecycle policy. */
export function normalizeSchema(value: unknown) {
  const schema = object(value, 'table schema');
  assert.equal(schema.LocalSecondaryIndexes, undefined, 'Unexpected local secondary indexes');
  const attributes = array(schema.AttributeDefinitions, 'attributes').map((entry) => {
    const attribute = object(entry, 'attribute');
    const name = text(attribute.AttributeName, 'attribute name');
    const type = text(attribute.AttributeType, 'attribute type');
    assert.ok(['S', 'N', 'B'].includes(type), 'Invalid attribute type');
    return { name, type };
  }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  unique(attributes.map((entry) => entry.name), 'attribute names');
  const indexes = array(schema.GlobalSecondaryIndexes, 'indexes').map((entry) => {
    const index = object(entry, 'index');
    const projection = object(index.Projection, 'projection');
    const type = text(projection.ProjectionType, 'projection type');
    assert.ok(['ALL', 'KEYS_ONLY', 'INCLUDE'].includes(type), 'Invalid projection type');
    const included = projection.NonKeyAttributes === undefined ? [] :
      array(projection.NonKeyAttributes, 'included attributes').map((name) => text(name, 'included attribute')).sort();
    unique(included, 'included attributes');
    if (type === 'INCLUDE') assert.ok(included.length > 0, 'INCLUDE must name projected attributes');
    else assert.equal(projection.NonKeyAttributes, undefined, 'Unexpected non-key projections');
    return { name: text(index.IndexName, 'index name'), keys: keys(index.KeySchema), projection: { type, included } };
  }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  unique(indexes.map((entry) => entry.name), 'index names');
  const ttl = object(schema.TimeToLiveSpecification, 'TTL');
  assert.equal(typeof ttl.Enabled, 'boolean', 'Invalid TTL enabled flag');
  return {
    attributes,
    keys: keys(schema.KeySchema),
    indexes,
    ttl: { name: text(ttl.AttributeName, 'TTL attribute'), enabled: ttl.Enabled },
    billing: text(schema.BillingMode, 'billing mode'),
  };
}

export function assertSchemaParity(backendExport: unknown, cloudProperties: unknown): void {
  const contract = object(backendExport, 'backend export');
  assert.equal(contract.schema_version, 1, 'Unsupported backend schema contract version');
  assert.deepEqual(normalizeSchema(cloudProperties), normalizeSchema(contract.table_schema),
    'CDK schema differs from the canonical backend local table contract');
}
