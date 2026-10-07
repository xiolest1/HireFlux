import assert from 'node:assert/strict';
import { test } from 'node:test';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { loadEnvironmentConfig } from '../lib/config/environment';
import { HireFluxStack } from '../lib/hireflux-stack';
import { FRONTEND_BUILD_SPEC, SPA_REWRITE_SOURCE } from '../lib/hosting/frontend-hosting';
import { fixtureArtifact } from './fixture';

const appId = 'FrontendHostingApp3EC0FC15';
const branchId = 'FrontendHostingBranchB5734B41';
const apiId = 'BackendApiHttpApiB4B1202A';
const functionId = 'BackendApiBackendFunctionFFB5248D';
const tokenId = 'AmplifyGitHubAccessToken';
const origin = { 'Fn::Join': ['', ['https://main.', { 'Fn::GetAtt': [appId, 'DefaultDomain'] }]] };

function references(value: any): Set<string> {
  const result = new Set<string>();
  if (Array.isArray(value)) for (const child of value) for (const ref of references(child)) result.add(ref);
  else if (value && typeof value === 'object') {
    if (typeof value.Ref === 'string') result.add(value.Ref);
    if (value['Fn::GetAtt']) result.add(Array.isArray(value['Fn::GetAtt']) ? value['Fn::GetAtt'][0] : value['Fn::GetAtt'].split('.')[0]);
    if (value['Fn::Sub']) {
      const expression = Array.isArray(value['Fn::Sub']) ? value['Fn::Sub'][0] : value['Fn::Sub'];
      for (const match of expression.matchAll(/\$\{([^}.]+)(?:\.[^}]+)?\}/g)) result.add(match[1]);
    }
    for (const child of Object.values(value)) for (const ref of references(child)) result.add(ref);
  }
  return result;
}

function assertAcyclic(template: any): void {
  const graph = new Map<string, Set<string>>();
  for (const [id, resource] of Object.entries(template.Resources) as [string, any][]) {
    const refs = references(resource);
    for (const dependency of [resource.DependsOn ?? []].flat()) refs.add(dependency);
    graph.set(id, new Set([...refs].filter((ref) => ref in template.Resources)));
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string): void {
    assert.ok(!visiting.has(id), `CloudFormation dependency cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const ref of graph.get(id)!) visit(ref);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of graph.keys()) visit(id);
}

function assertHostingGraph(template: any): void {
  assertAcyclic(template);
  assert.deepEqual([...references(template.Resources[appId])], [tokenId]);
  assert.deepEqual([...references(template.Resources[branchId])].sort(), [appId, apiId].sort());
  for (const id of [apiId, functionId]) {
    const refs = references(template.Resources[id]);
    assert.ok(refs.has(appId));
    assert.ok(!refs.has(branchId), 'Backend origin must never use a Branch attribute');
  }
}

function referencePaths(value: any, target: string, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [];
  const result: string[] = value.Ref === target ? [prefix] : [];
  for (const [key, child] of Object.entries(value)) result.push(...referencePaths(child, target, `${prefix}/${key}`));
  return result;
}

for (const environment of ['staging', 'production'] as const) {
  const config = loadEnvironmentConfig(environment);
  const stack = new HireFluxStack(new App(), `HireFlux-${environment}`, config, fixtureArtifact);
  const template = Template.fromStack(stack).toJSON();
  test(`${environment} has exactly one static app and explicit safe branch with stable identities`, () => {
    const hosting = Object.entries(template.Resources).filter(([, resource]: [string, any]) => resource.Type.startsWith('AWS::Amplify::'));
    assert.deepEqual(hosting.map(([id]) => id), [appId, branchId]);
    const app = template.Resources[appId];
    assert.equal(stack.frontendHosting.app.node.id, 'App');
    assert.equal(stack.frontendBranch.node.id, 'Branch');
    assert.equal(app.Properties.Name, `hireflux-${environment}-frontend`);
    assert.equal(app.Properties.Platform, 'WEB');
    assert.equal(app.Properties.Repository, 'https://github.com/xiolest1/HireFlux');
    assert.deepEqual(app.Properties.EnvironmentVariables, [{ Name: 'AMPLIFY_MONOREPO_APP_ROOT', Value: 'frontend' }]);
    assert.deepEqual(app.Properties.AutoBranchCreationConfig, { EnableAutoBranchCreation: false, EnablePullRequestPreview: false });
    assert.equal(app.Properties.EnableBranchAutoDeletion, false);
    assert.deepEqual(app.Properties.CustomRules, [{ Source: SPA_REWRITE_SOURCE, Target: '/index.html', Status: '200' }]);
    assert.equal(app.Properties.BuildSpec, FRONTEND_BUILD_SPEC);
    for (const property of ['CustomHeaders', 'IAMServiceRole', 'ComputeRoleArn', 'BasicAuthConfig', 'OauthToken']) assert.equal(app.Properties[property], undefined);
    const branch = template.Resources[branchId];
    assert.deepEqual(branch.Properties.AppId, { 'Fn::GetAtt': [appId, 'AppId'] });
    assert.equal(branch.Properties.BranchName, 'main');
    assert.equal(branch.Properties.Stage, environment === 'staging' ? 'BETA' : 'PRODUCTION');
    assert.equal(branch.Properties.EnableAutoBuild, environment === 'staging');
    assert.equal(branch.Properties.EnablePullRequestPreview, false);
    for (const property of ['Backend', 'ComputeRoleArn', 'BasicAuthConfig', 'PullRequestEnvironmentName', 'BuildSpec']) assert.equal(branch.Properties[property], undefined);
    for (const resource of [app, branch]) {
      assert.equal(resource.DeletionPolicy, 'Delete');
      assert.equal(resource.UpdateReplacePolicy, 'Delete');
      assert.deepEqual(resource.Properties.Tags, Object.entries(config.tags).sort().map(([Key, Value]) => ({ Key, Value })));
    }
  });
  test(`${environment} GitHub credential is a no-default NoEcho input used exclusively by App.AccessToken`, () => {
    assert.deepEqual(template.Parameters[tokenId], {
      Type: 'String', Description: 'Deploy-time Amplify GitHub repository authorization; Phase 4 prerequisite.',
      MaxLength: 4096, MinLength: 1, NoEcho: true,
    });
    assert.deepEqual(referencePaths(template, tokenId), [`/Resources/${appId}/Properties/AccessToken`]);
    assert.deepEqual(template.Outputs ?? {}, {});
    assert.doesNotMatch(JSON.stringify(template), /ghp_[A-Za-z0-9]{36}|github_pat_|synthetic-private|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY/);
  });
  test(`${environment} branch build variables and exact CORS derive only from its own App/API`, () => {
    assert.deepEqual(template.Resources[branchId].Properties.EnvironmentVariables, [
      { Name: 'VITE_API_BASE_URL', Value: { 'Fn::GetAtt': [apiId, 'ApiEndpoint'] } },
      { Name: 'VITE_WORKSPACE_MODE', Value: 'demo' },
      { Name: 'VITE_PUBLIC_SITE_URL', Value: origin },
    ]);
    assert.deepEqual(template.Resources[apiId].Properties.CorsConfiguration.AllowOrigins, [origin]);
    assert.deepEqual(template.Resources[functionId].Properties.Environment.Variables.CORS_ALLOWED_ORIGINS, origin);
    assert.equal(template.Resources[functionId].Properties.Environment.Variables.AUTH_MODE, environment === 'staging' ? 'demo' : 'cognito');
    assert.doesNotMatch(JSON.stringify(template), /staging\.invalid|production\.invalid|localhost|127\.0\.0\.1|Fn::ImportValue/);
    assert.equal(stack.frontendHosting.app.stack, stack);
    assert.equal(stack.frontendBranch.stack, stack);
    assert.equal(stack.dependencies.length, 0);
  });
  test(`${environment} full CloudFormation references and DependsOn are acyclic in App → backend → Branch order`, () => assertHostingGraph(template));
}

test('cycle regression rejects an API endpoint moved onto App environment variables', () => {
  const template = Template.fromStack(new HireFluxStack(new App(), 'CycleApp', loadEnvironmentConfig('staging'), fixtureArtifact)).toJSON();
  template.Resources[appId].Properties.EnvironmentVariables.push({ Name: 'VITE_API_BASE_URL', Value: { 'Fn::GetAtt': [apiId, 'ApiEndpoint'] } });
  assert.throws(() => assertHostingGraph(template), /dependency cycle/);
});

test('cycle regression rejects CORS constructed from a Branch attribute', () => {
  const template = Template.fromStack(new HireFluxStack(new App(), 'CycleBranch', loadEnvironmentConfig('staging'), fixtureArtifact)).toJSON();
  template.Resources[apiId].Properties.CorsConfiguration.AllowOrigins = [{ 'Fn::GetAtt': [branchId, 'BranchName'] }];
  assert.throws(() => assertHostingGraph(template), /dependency cycle/);
});

test('SPA rewrite preserves Vite/static asset extensions and handles direct route navigation', () => {
  const expression = new RegExp(SPA_REWRITE_SOURCE.slice(2, -2));
  for (const route of ['/', '/applications', '/applications/abc', '/applications/abc/edit', '/interviews', '/settings']) assert.ok(expression.test(route), route);
  for (const extension of ['js', 'mjs', 'css', 'png', 'jpg', 'jpeg', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'map', 'json', 'webp', 'avif', 'html', 'pdf', 'wasm', 'webmanifest']) {
    assert.ok(!expression.test(`/assets/example.${extension}`), extension);
  }
  assert.ok(!expression.test('/favicon.ico'));
});

test('hosting build stays frontend-only, lockfile-based and on the validated Node major', () => {
  assert.match(FRONTEND_BUILD_SPEC, /appRoot: frontend/);
  assert.match(FRONTEND_BUILD_SPEC, /- nvm install 22\n\s+- nvm use 22\n\s+- npm ci/);
  assert.match(FRONTEND_BUILD_SPEC, /- npm run build/);
  assert.match(FRONTEND_BUILD_SPEC, /baseDirectory: dist/);
  assert.doesNotMatch(FRONTEND_BUILD_SPEC, /backend:|buildPath:|npm install|npm update|latest|amplifyPush|cdk |aws |python|pip |CustomHeaders/);
});

test('two explicitly bound environment stacks own separate App/Branch resources and only local backend references', () => {
  const app = new App();
  const staging = new HireFluxStack(app, 'HireFlux-staging', loadEnvironmentConfig('staging', '111111111111'), fixtureArtifact);
  const production = new HireFluxStack(app, 'HireFlux-production', loadEnvironmentConfig('production', '222222222222'), fixtureArtifact);
  assert.notEqual(staging.frontendHosting.app, production.frontendHosting.app);
  assert.notEqual(staging.frontendBranch, production.frontendBranch);
  assert.notEqual(staging.frontendHosting.frontendOrigin, production.frontendHosting.frontendOrigin);
  for (const stack of [staging, production]) {
    const template = Template.fromStack(stack).toJSON();
    assertHostingGraph(template);
    assert.equal(stack.frontendHosting.app.stack, stack);
    assert.equal(stack.frontendBranch.stack, stack);
    assert.equal(stack.dependencies.length, 0);
    assert.doesNotMatch(JSON.stringify(template), /Fn::ImportValue/);
    assert.deepEqual(stack.resolve(stack.frontendHosting.frontendOrigin), origin);
  }
});

