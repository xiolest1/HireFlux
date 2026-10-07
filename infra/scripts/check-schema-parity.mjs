import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { composeEnvironment } from '../build/lib/app.js';
import { assertSchemaParity } from '../build/lib/data/schema-parity.js';

const { values } = parseArgs({ options: { schema: { type: 'string' } } });
assert.ok(values.schema, 'Supply --schema pointing to a fresh backend schema export.');
const contract = JSON.parse(readFileSync(resolve(values.schema), 'utf8'));
for (const environment of ['staging', 'production']) {
  const scratch = mkdtempSync(join(tmpdir(), 'hireflux-schema-parity-'));
  const previousAuditPath = process.env.HIREFLUX_NETWORK_AUDIT_PATH;
  const auditPath = join(scratch, 'network-attempts');
  process.env.HIREFLUX_NETWORK_AUDIT_PATH = auditPath;
  try {
    const stack = composeEnvironment(new App({ outdir: scratch, analyticsReporting: false, context: { environment } }));
    const template = Template.fromStack(stack);
    const resources = template.toJSON().Resources;
    assert.equal(Object.keys(resources).length, 13, 'Unexpected browser-to-backend resource inventory.');
    const tables = template.findResources('AWS::DynamoDB::Table');
    assert.equal(Object.keys(tables).length, 1, 'Exactly one DynamoDB table is required.');
    const [logicalId, table] = Object.entries(tables)[0];
    assertSchemaParity(contract, table.Properties);
    assert.equal(existsSync(auditPath), false, 'Schema parity attempted network access.');
    console.log(`${environment}: ${logicalId} matches backend keys/types, three GSIs/projections, TTL and billing.`);
  } finally {
    if (previousAuditPath === undefined) delete process.env.HIREFLUX_NETWORK_AUDIT_PATH;
    else process.env.HIREFLUX_NETWORK_AUDIT_PATH = previousAuditPath;
    const withinTemporaryRoot = relative(resolve(tmpdir()), resolve(scratch));
    assert.ok(withinTemporaryRoot !== '' && !isAbsolute(withinTemporaryRoot) && !withinTemporaryRoot.startsWith('..'));
    rmSync(scratch, { recursive: true, force: true });
  }
}
