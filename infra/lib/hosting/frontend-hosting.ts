import { RemovalPolicy } from 'aws-cdk-lib';
import { CfnApp, CfnBranch } from 'aws-cdk-lib/aws-amplify';
import { Construct } from 'constructs';
import type { HireFluxEnvironmentConfig } from '../config/environment';
import { explicitResourceName } from '../config/naming';
import path from 'node:path';
import { existsSync } from 'node:fs';

// One shared pure policy engine supplies browser trust, offline YAML and App headers.
// Resolve source/build layouts without importing frontend TypeScript into rootDir.
const policyPaths = ['../../../frontend/src/publicDeploymentPolicy.mjs', '../../../../frontend/src/publicDeploymentPolicy.mjs'];
const policyPath = policyPaths.map((candidate) => path.resolve(__dirname, candidate)).find(existsSync);
if (!policyPath) throw new Error('Shared public deployment/header policy is missing.');
const { renderHostedHeaders } = require(policyPath) as {
  renderHostedHeaders(environment: 'staging' | 'production', options?: { legacyStaging?: boolean }): string;
};

// AWS's SPA expression, extended for the static extensions used by this Vite app.
export const SPA_REWRITE_SOURCE = '</^[^.]+$|\\.(?!(css|gif|ico|jpg|jpeg|js|mjs|png|txt|svg|woff|woff2|ttf|map|json|webp|avif|html|pdf|wasm|webmanifest)$)([^.]+$)/>';

// Build runs in appRoot, never the repository root/backend/infra.
export const FRONTEND_BUILD_SPEC = `version: 1
applications:
  - appRoot: frontend
    frontend:
      phases:
        preBuild:
          commands:
            - nvm install 22
            - nvm use 22
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: dist
        files:
          - '**/*'
`;

// New production builds must pass the publication guard. Unbound targets and
// retained root-header authority are expected blockers, never publishable fixtures.
export const PRODUCTION_FRONTEND_BUILD_SPEC = FRONTEND_BUILD_SPEC.replace(
  '            - npm run build',
  '            - npm run build\n            - node scripts/verify-hosted-build.mjs --publication --environment production',
);

export class FrontendHosting extends Construct {
  public readonly app: CfnApp;
  public readonly frontendOrigin: string;

  constructor(scope: Construct, id: string, private readonly config: HireFluxEnvironmentConfig, accessToken: string) {
    super(scope, id);
    this.app = new CfnApp(this, 'App', {
      name: explicitResourceName(config, 'frontend'), repository: config.hosting.repositoryUrl,
      platform: 'WEB', accessToken,
      buildSpec: config.environmentName === 'production' ? PRODUCTION_FRONTEND_BUILD_SPEC : FRONTEND_BUILD_SPEC,
      // Staging retains root YAML authority without an unnecessary App update.
      // Production stays self-only while unbound; its header migration and
      // publication remain separately gated.
      ...(config.environmentName === 'production'
        ? { customHeaders: renderHostedHeaders('production') }
        : {}),
      environmentVariables: [{ name: 'AMPLIFY_MONOREPO_APP_ROOT', value: config.hosting.appRoot }],
      autoBranchCreationConfig: { enableAutoBranchCreation: false, enablePullRequestPreview: false },
      enableBranchAutoDeletion: false,
      customRules: [{ source: SPA_REWRITE_SOURCE, target: '/index.html', status: '200' }],
    });
    this.app.applyRemovalPolicy(RemovalPolicy.DESTROY);
    // Configured branch string avoids a backend dependency on the Branch resource.
    this.frontendOrigin = `https://${config.hosting.sourceBranch}.${this.app.attrDefaultDomain}`;
  }

  public addBranch(apiEndpoint: string): CfnBranch {
    const branch = new CfnBranch(this, 'Branch', {
      appId: this.app.attrAppId, branchName: this.config.hosting.sourceBranch,
      stage: this.config.hosting.stage, enableAutoBuild: this.config.hosting.autoBuild,
      enablePullRequestPreview: false,
      environmentVariables: [
        { name: 'VITE_API_BASE_URL', value: apiEndpoint },
        { name: 'VITE_WORKSPACE_MODE', value: this.config.hosting.workspaceMode },
        { name: 'VITE_PUBLIC_SITE_URL', value: this.frontendOrigin },
      ],
    });
    branch.applyRemovalPolicy(RemovalPolicy.DESTROY);
    return branch;
  }
}
