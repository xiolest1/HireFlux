/** Current shared-production offline reviews. Never an AWS executor or approval. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { verifyBackendArtifact } from '../backend/artifact';
import type { OfflineTemplate } from './update-contract';

export const contentSha256 = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');

const PRODUCTION_COUNTS: Readonly<Record<string, number>> = Object.freeze({
  'AWS::DynamoDB::Table': 1, 'AWS::Lambda::Function': 1, 'AWS::ApiGatewayV2::Api': 1,
  'AWS::ApiGatewayV2::Integration': 1, 'AWS::ApiGatewayV2::Route': 2,
  'AWS::ApiGatewayV2::Stage': 1, 'AWS::Lambda::Permission': 1,
  'AWS::IAM::Role': 1, 'AWS::IAM::Policy': 1, 'AWS::SecretsManager::Secret': 2,
  'AWS::Logs::LogGroup': 2, 'AWS::CloudWatch::Alarm': 5,
  'AWS::Amplify::App': 1, 'AWS::Amplify::Branch': 1,
  'AWS::Cognito::UserPool': 1, 'AWS::Cognito::UserPoolClient': 1,
  'AWS::Cognito::UserPoolDomain': 1, 'AWS::Cognito::ManagedLoginBranding': 1,
  'AWS::SNS::Topic': 1, 'AWS::SNS::Subscription': 1, 'AWS::SNS::TopicPolicy': 1,
  'AWS::Budgets::Budget': 1,
});

function resource(template: OfflineTemplate, type: string): [string, any] {
  const matches = Object.entries(template.Resources).filter(([, item]) => item.Type === type);
  assert.equal(matches.length, 1, `Expected one ${type}.`);
  return matches[0]!;
}

function hash(value: string): void { assert.match(value, /^[a-f0-9]{64}$/); }

/** A source tuple must cover the complete nonignored working tree, including
 * unpublished files; a selected-file hash list cannot establish immutability.
 */
export function assertCompleteSourceInventory(snapshotFiles: readonly string[], workingTreeFiles: readonly string[]): void {
  for (const files of [snapshotFiles, workingTreeFiles]) {
    assert.ok(files.every((name) => typeof name === 'string' && name.length > 0));
    assert.equal(new Set(files).size, files.length, 'Duplicate source inventory path.');
  }
  assert.deepEqual([...snapshotFiles].sort(), [...workingTreeFiles].sort(), 'Source inventory changed or is incomplete.');
}

/** Validates an initial closed CREATE shape; intentionally cannot approve publication. */
export function reviewSharedProductionCreate(templateJson: string, evidence: {
  templateSha256: string; backendZipSha256: string;
}) {
  hash(evidence.templateSha256); hash(evidence.backendZipSha256);
  assert.equal(contentSha256(templateJson), evidence.templateSha256, 'Template bytes changed.');
  const template = JSON.parse(templateJson) as OfflineTemplate;
  assert.equal(template.Metadata?.HireFlux?.environmentName, 'production');
  assert.equal(template.Metadata?.HireFlux?.awsRegion, 'us-east-1');
  const counts: Record<string, number> = {};
  for (const value of Object.values(template.Resources)) counts[value.Type] = (counts[value.Type] ?? 0) + 1;
  assert.deepEqual(counts, PRODUCTION_COUNTS, 'Unexpected resource inventory.');
  assert.deepEqual(template.Outputs ?? {}, {});
  const [, table] = resource(template, 'AWS::DynamoDB::Table');
  assert.equal(table.DeletionPolicy, 'Retain'); assert.equal(table.UpdateReplacePolicy, 'Retain');
  assert.equal(table.Properties.BillingMode, 'PAY_PER_REQUEST');
  assert.equal(table.Properties.DeletionProtectionEnabled, true);
  assert.equal(table.Properties.PointInTimeRecoverySpecification.PointInTimeRecoveryEnabled, true);
  assert.deepEqual(table.Properties.TimeToLiveSpecification, { AttributeName: 'expires_at', Enabled: true });
  assert.deepEqual(table.Properties.GlobalSecondaryIndexes.map((index: any) => index.IndexName), ['GSI1', 'GSI2', 'GSI3']);
  const [, pool] = resource(template, 'AWS::Cognito::UserPool');
  assert.deepEqual(pool.Properties.AdminCreateUserConfig, { AllowAdminCreateUserOnly: true });
  assert.equal(pool.Properties.DeletionProtection, 'ACTIVE');
  assert.equal(pool.DeletionPolicy, 'Retain'); assert.equal(pool.UpdateReplacePolicy, 'Retain');
  const [poolId] = resource(template, 'AWS::Cognito::UserPool');
  const [clientId, client] = resource(template, 'AWS::Cognito::UserPoolClient');
  assert.equal(client.Properties.GenerateSecret, false);
  assert.deepEqual(client.Properties.AllowedOAuthFlows, ['code']);
  const [, fn] = resource(template, 'AWS::Lambda::Function');
  const vars = fn.Properties.Environment.Variables;
  assert.equal(vars.ENVIRONMENT, 'production'); assert.equal(vars.AUTH_MODE, 'cognito');
  assert.equal(vars.AUTH_CAPABILITIES, 'demo,cognito');
  assert.equal(vars.DEMO_SESSION_TTL_HOURS, '24');
  assert.equal(vars.COGNITO_SELF_REGISTRATION_ENABLED, 'false');
  assert.deepEqual(vars.COGNITO_USER_POOL_ID, { Ref: poolId });
  assert.deepEqual(vars.COGNITO_APP_CLIENT_ID, { Ref: clientId });
  for (const forbidden of ['AWS_PROFILE', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'DYNAMODB_ENDPOINT_URL', 'CURSOR_SIGNING_KEY', 'DEMO_SESSION_SIGNING_KEY']) assert.equal(vars[forbidden], undefined);
  assert.equal(fn.Properties.Code.S3Key, `${contentSha256(evidence.backendZipSha256)}.zip`);
  const [, branch] = resource(template, 'AWS::Amplify::Branch');
  assert.equal(branch.Properties.EnableAutoBuild, false); assert.equal(branch.Properties.Stage, 'PRODUCTION');
  const [, app] = resource(template, 'AWS::Amplify::App');
  assert.equal(typeof app.Properties.CustomHeaders, 'string');
  assert.match(app.Properties.BuildSpec, /verify-hosted-build.*--publication.*--environment production/);
  assert.equal(template.Parameters.AmplifyGitHubAccessToken.NoEcho, true);
  return {
    review: 'OFFLINE_SHARED_PRODUCTION_CREATE', declarations: Object.keys(template.Resources).length,
    expectedRegistration: 'CLOSED', expectedIssuance: 'PAUSED_WITHOUT_POLICY',
    publicationReady: false, liveIdentityAndHeaderBindingRequired: true,
  } as const;
}

export interface ProductionBinding {
  environment: 'production'; siteOrigin: string; apiOrigin: string;
  capabilities: readonly string[];
  cognito: { issuer: string; clientId: string; domain: string };
  callbackUrl: string; logoutUrl: string; selfRegistrationEnabled: boolean;
}

function productionBinding(binding: ProductionBinding): void {
  // Same pure policy as browser/CDK headers; no parallel provider allowlist.
  const policy = require(resolve(__dirname, '../../../../frontend/src/publicDeploymentPolicy.mjs')) as {
    validBinding: (binding: ProductionBinding, environment: string) => boolean;
    reviewedPublicDeployments: { staging: Omit<ProductionBinding, 'environment'> | null };
  };
  assert.ok(policy.validBinding(binding, 'production'), 'Incomplete exact production binding.');
  assert.deepEqual([...binding.capabilities].sort(), ['cognito', 'demo']);
  const stage = policy.reviewedPublicDeployments.staging;
  if (stage) {
    assert.notEqual(binding.siteOrigin, stage.siteOrigin); assert.notEqual(binding.apiOrigin, stage.apiOrigin);
    assert.notEqual(binding.cognito.issuer, stage.cognito.issuer);
    assert.notEqual(binding.cognito.clientId, stage.cognito.clientId);
    assert.notEqual(binding.cognito.domain, stage.cognito.domain);
  }
}

/** Exact byte/content evidence is necessary, never sufficient owner authorization. */
export function reviewReleaseTupleConsistency(evidence: {
  binding: ProductionBinding | null;
  repositoryRootHeaders: string | null;
  expectedTupleSha256: string;
  tuple: {
    sourceSnapshotSha256: string; backendZipSha256: string; templateSha256: string;
    iamPolicySha256: string; frontendContentsSha256: string; headerPolicySha256: string;
    bindingSha256: string; publicationScanReceiptSha256: string;
  };
}) {
  assert.ok(evidence.binding, 'Production identities remain unbound.');
  productionBinding(evidence.binding);
  assert.equal(evidence.binding.selfRegistrationEnabled, false, 'Initial publication stays CLOSED.');
  assert.equal(evidence.repositoryRootHeaders, null, 'Repository root header authority must be separately retired before production publication.');
  for (const value of Object.values(evidence.tuple)) hash(value);
  assert.equal(contentSha256(JSON.stringify(evidence.binding)), evidence.tuple.bindingSha256);
  hash(evidence.expectedTupleSha256);
  assert.equal(contentSha256(JSON.stringify(evidence.tuple)), evidence.expectedTupleSha256, 'Release components changed.');
  return { review: 'OFFLINE_RELEASE_TUPLE_CONSISTENCY', publicationQualified: false, awsAuthorization: false } as const;
}

/** Actual local bytes and the canonical bound target are required by this entry
 * point. There is no fixture/target override. Initial unbound source must STOP.
 */
export async function reviewProductionPublication(evidence: {
  expectedTupleSha256: string;
  tuple: Parameters<typeof reviewReleaseTupleConsistency>[0]['tuple'];
  sourceSnapshotJson: string; templateJson: string; frontendDirectory: string; backendZip: string;
}) {
  const root = resolve(__dirname, '../../../..');
  const policy = require(join(root, 'frontend/src/publicDeploymentPolicy.mjs'));
  const binding = policy.reviewedPublicDeployments.production as ProductionBinding | null;
  assert.ok(binding, 'Canonical production identities remain unbound.');
  const rootHeaders = join(root, 'customHttp.yml');
  reviewReleaseTupleConsistency({ ...evidence, binding,
    repositoryRootHeaders: existsSync(rootHeaders) ? readFileSync(rootHeaders, 'utf8') : null });
  const zip = verifyBackendArtifact(root, evidence.backendZip);
  assert.equal(zip.sha256, evidence.tuple.backendZipSha256);
  assert.equal(contentSha256(evidence.templateJson), evidence.tuple.templateSha256);
  reviewSharedProductionCreate(evidence.templateJson, {
    templateSha256: evidence.tuple.templateSha256, backendZipSha256: zip.sha256,
  });
  const template = JSON.parse(evidence.templateJson) as OfflineTemplate;
  const [, app] = resource(template, 'AWS::Amplify::App');
  const exactHeaders = policy.renderHostedHeaders('production');
  assert.equal(app.Properties.CustomHeaders, exactHeaders);
  assert.equal(contentSha256(exactHeaders), evidence.tuple.headerPolicySha256);
  const [, iam] = resource(template, 'AWS::IAM::Policy');
  assert.equal(contentSha256(JSON.stringify(iam.Properties.PolicyDocument)), evidence.tuple.iamPolicySha256);
  assert.equal(contentSha256(evidence.sourceSnapshotJson), evidence.tuple.sourceSnapshotSha256);
  const snapshot = JSON.parse(evidence.sourceSnapshotJson);
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.head, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim());
  assert.ok(snapshot.files && typeof snapshot.files === 'object' && !Array.isArray(snapshot.files) && Object.keys(snapshot.files).length > 0);
  const inventory = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' });
  assert.ok(inventory.endsWith('\0'), 'Incomplete source inventory output.');
  assertCompleteSourceInventory(Object.keys(snapshot.files), inventory.slice(0, -1).split('\0'));
  for (const [name, expected] of Object.entries(snapshot.files)) {
    assert.ok(!isAbsolute(name) && !name.split(/[\\/]/).includes('..') && !name.includes('.aws'));
    const filename = resolve(root, name);
    assert.ok(!lstatSync(filename).isSymbolicLink());
    assert.equal(contentSha256(readFileSync(filename)), expected, `Source changed: ${name}`);
  }
  for (const required of ['backend/uv.lock', 'frontend/package-lock.json', 'infra/package-lock.json', 'frontend/src/deployment-targets.json']) {
    assert.ok(snapshot.files[required], `Missing release source: ${required}`);
  }
  const directory = resolve(root, evidence.frontendDirectory);
  const within = relative(root, directory);
  assert.ok(within && !within.startsWith('..') && !isAbsolute(within));
  const contents: { path: string; sha256: string; bytes: number }[] = [];
  function visit(current: string): void {
    for (const item of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      assert.ok(!item.isSymbolicLink());
      const filename = join(current, item.name);
      if (item.isDirectory()) visit(filename);
      else { const bytes = readFileSync(filename); contents.push({ path: relative(directory, filename).replaceAll('\\', '/'), sha256: contentSha256(bytes), bytes: bytes.length }); }
    }
  }
  visit(directory);
  assert.equal(contentSha256(JSON.stringify(contents)), evidence.tuple.frontendContentsSha256);
  const scanner = await import(pathToFileURL(join(root, 'frontend/scripts/verify-hosted-build.mjs')).href);
  const receipt = await scanner.verifyPublicationBuild(directory, { environment: 'production',
    apiBaseUrl: binding.apiOrigin, siteUrl: binding.siteOrigin, workspaceMode: 'demo' });
  assert.equal(contentSha256(JSON.stringify(receipt)), evidence.tuple.publicationScanReceiptSha256);
  return { review: 'OFFLINE_BOUND_PRODUCTION_PUBLICATION', publicationQualified: true, awsAuthorization: false } as const;
}

/** Future target-bound paired activation review; normal CDK configuration stays CLOSED.
 * Actual production IDs, accepted deployed baseline and prerequisite receipts must
 * first be obtained and owner-reviewed in later explicitly authorized gates.
 */
export function reviewProductionActivation(input: {
  intent: 'OPEN_PRODUCTION_SELF_REGISTRATION';
  target: { account: string; region: 'us-east-1'; stackName: 'hireflux-production'; poolId: string; clientId: string };
  closedTemplateJson: string; proposedTemplateJson: string;
  closedTemplateSha256: string; proposedTemplateSha256: string;
  backendZipSha256: string;
  acceptedDeploymentJson: string; acceptedDeploymentSha256: string;
  closedBinding: ProductionBinding; proposedBinding: ProductionBinding;
  closedBindingSha256: string; proposedBindingSha256: string; proposedFrontendContentsSha256: string;
  prerequisites: { recoverySha256: string; realAccountsSha256: string; operationsSha256: string; privacySha256: string };
}) {
  assert.equal(input.intent, 'OPEN_PRODUCTION_SELF_REGISTRATION');
  assert.match(input.target.account, /^\d{12}$/); assert.equal(input.target.region, 'us-east-1');
  assert.equal(input.target.stackName, 'hireflux-production');
  for (const value of [input.closedTemplateSha256, input.proposedTemplateSha256,
    input.acceptedDeploymentSha256,
    input.backendZipSha256,
    input.closedBindingSha256, input.proposedBindingSha256, input.proposedFrontendContentsSha256,
    input.prerequisites.recoverySha256, input.prerequisites.realAccountsSha256,
    input.prerequisites.operationsSha256, input.prerequisites.privacySha256]) hash(value);
  assert.equal(contentSha256(input.closedTemplateJson), input.closedTemplateSha256);
  assert.equal(contentSha256(input.proposedTemplateJson), input.proposedTemplateSha256);
  assert.equal(contentSha256(input.acceptedDeploymentJson), input.acceptedDeploymentSha256);
  assert.equal(contentSha256(JSON.stringify(input.closedBinding)), input.closedBindingSha256);
  assert.equal(contentSha256(JSON.stringify(input.proposedBinding)), input.proposedBindingSha256);
  productionBinding(input.closedBinding); productionBinding(input.proposedBinding);
  assert.equal(input.closedBinding.selfRegistrationEnabled, false);
  assert.equal(input.proposedBinding.selfRegistrationEnabled, true);
  assert.equal(input.closedBinding.cognito.issuer, `https://cognito-idp.us-east-1.amazonaws.com/${input.target.poolId}`);
  assert.equal(input.closedBinding.cognito.clientId, input.target.clientId);
  assert.deepEqual({ ...input.proposedBinding, selfRegistrationEnabled: false }, input.closedBinding);
  const before = JSON.parse(input.closedTemplateJson) as OfflineTemplate;
  reviewSharedProductionCreate(input.closedTemplateJson, {
    templateSha256: input.closedTemplateSha256, backendZipSha256: input.backendZipSha256,
  });
  const after = JSON.parse(input.proposedTemplateJson) as OfflineTemplate;
  assert.equal(before.Metadata?.HireFlux?.environmentName, 'production');
  assert.equal(before.Metadata?.HireFlux?.accountBinding, 'explicit');
  assert.equal(before.Metadata?.HireFlux?.awsRegion, input.target.region);
  const [, domain] = resource(before, 'AWS::Cognito::UserPoolDomain');
  assert.equal(domain.Properties.Domain, `hireflux-production-${input.target.account}-use1-20261020`);
  assert.equal(input.closedBinding.cognito.domain, `https://${domain.Properties.Domain}.auth.us-east-1.amazoncognito.com`);
  const [poolId, pool] = resource(before, 'AWS::Cognito::UserPool');
  const [clientId] = resource(before, 'AWS::Cognito::UserPoolClient');
  const [appId] = resource(before, 'AWS::Amplify::App');
  const [apiId] = resource(before, 'AWS::ApiGatewayV2::Api');
  const [functionId, fn] = resource(before, 'AWS::Lambda::Function');
  const deployed = JSON.parse(input.acceptedDeploymentJson);
  assert.equal(deployed.schemaVersion, 1);
  assert.equal(deployed.account, input.target.account);
  assert.equal(deployed.region, input.target.region);
  assert.equal(deployed.stackName, input.target.stackName);
  assert.match(deployed.stackArn, new RegExp(`^arn:aws:cloudformation:us-east-1:${input.target.account}:stack/hireflux-production/[a-f0-9-]{36}$`));
  assert.equal(deployed.closedTemplateSha256, input.closedTemplateSha256);
  for (const [logicalId, physicalId] of [[poolId, input.target.poolId], [clientId, input.target.clientId]] as const) {
    assert.equal(deployed.resources?.[logicalId]?.physicalId, physicalId);
    assert.equal(deployed.resources[logicalId].type, before.Resources[logicalId].Type);
  }
  for (const [logicalId, pattern] of [[appId, /^d[a-z0-9]{1,19}$/], [apiId, /^[a-z0-9]{10}$/]] as const) {
    assert.equal(deployed.resources?.[logicalId]?.type, before.Resources[logicalId].Type);
    assert.match(deployed.resources[logicalId].physicalId, pattern);
  }
  assert.equal(input.closedBinding.siteOrigin, `https://main.${deployed.resources?.[appId]?.physicalId}.amplifyapp.com`);
  assert.equal(input.closedBinding.apiOrigin, `https://${deployed.resources?.[apiId]?.physicalId}.execute-api.us-east-1.amazonaws.com`);
  assert.deepEqual(pool.Properties.AdminCreateUserConfig, { AllowAdminCreateUserOnly: true });
  assert.equal(fn.Properties.Environment.Variables.COGNITO_SELF_REGISTRATION_ENABLED, 'false');
  assert.deepEqual(after.Resources[poolId]?.Properties.AdminCreateUserConfig, { AllowAdminCreateUserOnly: false });
  assert.equal(after.Resources[functionId]?.Properties.Environment.Variables.COGNITO_SELF_REGISTRATION_ENABLED, 'true');
  const normalized = structuredClone(after);
  normalized.Resources[poolId].Properties.AdminCreateUserConfig = pool.Properties.AdminCreateUserConfig;
  normalized.Resources[functionId].Properties.Environment.Variables.COGNITO_SELF_REGISTRATION_ENABLED = 'false';
  assert.ok(isDeepStrictEqual(normalized, before), 'Activation changes unrelated infrastructure.');
  return { review: 'OFFLINE_TARGET_BOUND_ACTIVATION', modifications: [poolId, functionId], awsAuthorization: false } as const;
}
