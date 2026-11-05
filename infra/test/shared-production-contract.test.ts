import assert from 'node:assert/strict';
import { test } from 'node:test';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { loadEnvironmentConfig } from '../lib/config/environment';
import { HireFluxStack } from '../lib/hireflux-stack';
import { contentSha256, reviewSharedProductionCreate, reviewReleaseTupleConsistency,
  reviewProductionPublication, reviewProductionActivation, assertCompleteSourceInventory, type ProductionBinding } from '../lib/release/shared-production-contract';
import { fixtureArtifact } from './fixture';

const original = Template.fromStack(new HireFluxStack(new App({ analyticsReporting: false }),
  'ReleaseFixture', loadEnvironmentConfig('production', '222222222222'), fixtureArtifact)).toJSON();
const templateJson = JSON.stringify(original);
const hash = 'a'.repeat(64);
const binding: ProductionBinding = {
  environment: 'production', siteOrigin: 'https://main.dfixtureprod1.amplifyapp.com',
  apiOrigin: 'https://fixtureapi.execute-api.us-east-1.amazonaws.com', capabilities: ['demo', 'cognito'],
  cognito: { issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_FICTIONAL',
    clientId: 'FICTIONALPUBLICCLIENT', domain: 'https://hireflux-production-222222222222-use1-20261020.auth.us-east-1.amazoncognito.com' },
  callbackUrl: 'https://main.dfixtureprod1.amplifyapp.com/auth/callback',
  logoutUrl: 'https://main.dfixtureprod1.amplifyapp.com/auth/signed-out', selfRegistrationEnabled: false,
};
function one(type: string): string {
  return Object.entries(original.Resources).find(([, value]) => (value as { Type: string }).Type === type)![0];
}
function tupleEvidence() {
  const tuple = { sourceSnapshotSha256: hash, backendZipSha256: hash, templateSha256: hash,
    iamPolicySha256: hash, frontendContentsSha256: hash, headerPolicySha256: hash,
    bindingSha256: contentSha256(JSON.stringify(binding)), publicationScanReceiptSha256: hash };
  return { binding, repositoryRootHeaders: null, tuple, expectedTupleSha256: contentSha256(JSON.stringify(tuple)) };
}
function activation() {
  const proposed = structuredClone(original);
  proposed.Resources[one('AWS::Cognito::UserPool')].Properties.AdminCreateUserConfig.AllowAdminCreateUserOnly = false;
  proposed.Resources[one('AWS::Lambda::Function')].Properties.Environment.Variables.COGNITO_SELF_REGISTRATION_ENABLED = 'true';
  const proposedTemplateJson = JSON.stringify(proposed);
  const closedTemplateSha256 = contentSha256(templateJson);
  const acceptedDeploymentJson = JSON.stringify({ schemaVersion: 1, account: '222222222222', region: 'us-east-1', stackName: 'hireflux-production',
    stackArn: 'arn:aws:cloudformation:us-east-1:222222222222:stack/hireflux-production/00000000-0000-4000-8000-000000000001',
    closedTemplateSha256, resources: {
      [one('AWS::Cognito::UserPool')]: { type: 'AWS::Cognito::UserPool', physicalId: 'us-east-1_FICTIONAL' },
      [one('AWS::Cognito::UserPoolClient')]: { type: 'AWS::Cognito::UserPoolClient', physicalId: 'FICTIONALPUBLICCLIENT' },
      [one('AWS::Amplify::App')]: { type: 'AWS::Amplify::App', physicalId: 'dfixtureprod1' },
      [one('AWS::ApiGatewayV2::Api')]: { type: 'AWS::ApiGatewayV2::Api', physicalId: 'fixtureapi' },
    } });
  const proposedBinding = { ...binding, selfRegistrationEnabled: true };
  return { intent: 'OPEN_PRODUCTION_SELF_REGISTRATION' as const,
    target: { account: '222222222222', region: 'us-east-1' as const, stackName: 'hireflux-production' as const, poolId: 'us-east-1_FICTIONAL', clientId: 'FICTIONALPUBLICCLIENT' },
    closedTemplateJson: templateJson, proposedTemplateJson, closedTemplateSha256,
    proposedTemplateSha256: contentSha256(proposedTemplateJson), backendZipSha256: fixtureArtifact.sha256,
    acceptedDeploymentJson, acceptedDeploymentSha256: contentSha256(acceptedDeploymentJson),
    closedBinding: binding, proposedBinding, closedBindingSha256: contentSha256(JSON.stringify(binding)),
    proposedBindingSha256: contentSha256(JSON.stringify(proposedBinding)), proposedFrontendContentsSha256: hash,
    prerequisites: { recoverySha256: hash, realAccountsSha256: hash, operationsSha256: hash, privacySha256: hash } };
}

test('new production CREATE is qualified separately and remains unpublished, closed and default-paused', () => {
  const result = reviewSharedProductionCreate(templateJson, { templateSha256: contentSha256(templateJson), backendZipSha256: fixtureArtifact.sha256 });
  assert.equal(result.declarations, 29); assert.equal(result.publicationReady, false);
  assert.equal(result.expectedRegistration, 'CLOSED'); assert.equal(result.expectedIssuance, 'PAUSED_WITHOUT_POLICY');
});
for (const [label, change] of [
  ['unprotected table', (t: any) => { t.Resources[one('AWS::DynamoDB::Table')].Properties.DeletionProtectionEnabled = false; }],
  ['open registration', (t: any) => { t.Resources[one('AWS::Cognito::UserPool')].Properties.AdminCreateUserConfig.AllowAdminCreateUserOnly = false; }],
  ['extra resource', (t: any) => { t.Resources.Extra = { Type: 'AWS::DynamoDB::Table' }; }],
  ['missing artifact', (t: any) => { t.Resources[one('AWS::Lambda::Function')].Properties.Code.S3Key = 'other.zip'; }],
  ['automatic builds', (t: any) => { t.Resources[one('AWS::Amplify::Branch')].Properties.EnableAutoBuild = true; }],
] as const) test(`CREATE rejects ${label}`, () => {
  const modified = structuredClone(original); change(modified); const bytes = JSON.stringify(modified);
  assert.throws(() => reviewSharedProductionCreate(bytes, { templateSha256: contentSha256(bytes), backendZipSha256: fixtureArtifact.sha256 }));
});

test('tuple consistency is explicitly weaker than publication and rejects stale components/root authority', () => {
  const input = tupleEvidence();
  assert.equal(reviewReleaseTupleConsistency(input).publicationQualified, false);
  assert.throws(() => reviewReleaseTupleConsistency({ ...input, binding: null }), /unbound/);
  assert.throws(() => reviewReleaseTupleConsistency({ ...input, repositoryRootHeaders: 'still active' }), /header authority/);
  assert.throws(() => reviewReleaseTupleConsistency({ ...input, tuple: { ...input.tuple, backendZipSha256: 'b'.repeat(64) } }), /components changed/);
});
test('actual publication cannot substitute a fictional binding for canonical unbound production', async () => {
  const input = tupleEvidence();
  await assert.rejects(reviewProductionPublication({ expectedTupleSha256: input.expectedTupleSha256, tuple: input.tuple,
    sourceSnapshotJson: '{}', templateJson, frontendDirectory: '.tools/nonexistent', backendZip: '.tools/nonexistent.zip' }), /Canonical production identities remain unbound/);
});
test('publication source inventory includes all tracked and untracked nonignored paths exactly once', () => {
  const current = ['backend/src/app.py', 'frontend/src/new-untracked.ts', 'infra/lib/app.ts'];
  assert.doesNotThrow(() => assertCompleteSourceInventory([...current].reverse(), current));
  assert.throws(() => assertCompleteSourceInventory(current.slice(1), current), /incomplete/);
  assert.throws(() => assertCompleteSourceInventory([...current, 'deleted-source.ts'], current), /incomplete/);
  assert.throws(() => assertCompleteSourceInventory(current, [...current, 'new-source.ts']), /incomplete/);
  assert.throws(() => assertCompleteSourceInventory([...current, current[0]!], current), /Duplicate/);
  assert.throws(() => assertCompleteSourceInventory(current, [...current, current[0]!]), /Duplicate/);
});
test('future activation binds exact deployed target, baseline, provider and public advertisement together', () => {
  const result = reviewProductionActivation(activation());
  assert.equal(result.modifications.length, 2); assert.equal(result.awsAuthorization, false);
});
for (const fault of ['account', 'pool', 'receipt', 'missing-prerequisite', 'unrelated-change', 'half-open', 'binding-change'] as const) {
  test(`activation rejects ${fault} without weakening historical reviewers`, () => {
    const input = activation();
    if (fault === 'account') input.target.account = '333333333333';
    if (fault === 'pool') input.target.poolId = 'us-east-1_OTHER';
    if (fault === 'receipt') input.acceptedDeploymentJson += ' ';
    if (fault === 'missing-prerequisite') delete (input.prerequisites as Partial<typeof input.prerequisites>).operationsSha256;
    if (fault === 'binding-change') {
      input.proposedBinding.apiOrigin = 'https://wrong.example.invalid';
      input.proposedBindingSha256 = contentSha256(JSON.stringify(input.proposedBinding));
    }
    if (fault === 'unrelated-change' || fault === 'half-open') {
      const candidate = JSON.parse(input.proposedTemplateJson);
      if (fault === 'unrelated-change') candidate.Resources[one('AWS::DynamoDB::Table')].Properties.DeletionProtectionEnabled = false;
      else candidate.Resources[one('AWS::Lambda::Function')].Properties.Environment.Variables.COGNITO_SELF_REGISTRATION_ENABLED = 'false';
      input.proposedTemplateJson = JSON.stringify(candidate); input.proposedTemplateSha256 = contentSha256(input.proposedTemplateJson);
    }
    assert.throws(() => reviewProductionActivation(input));
  });
}
