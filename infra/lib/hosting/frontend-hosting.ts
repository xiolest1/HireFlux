import { RemovalPolicy } from 'aws-cdk-lib';
import { CfnApp, CfnBranch } from 'aws-cdk-lib/aws-amplify';
import { Construct } from 'constructs';
import type { HireFluxEnvironmentConfig } from '../config/environment';
import { explicitResourceName } from '../config/naming';

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

export class FrontendHosting extends Construct {
  public readonly app: CfnApp;
  public readonly frontendOrigin: string;

  constructor(scope: Construct, id: string, private readonly config: HireFluxEnvironmentConfig, accessToken: string) {
    super(scope, id);
    this.app = new CfnApp(this, 'App', {
      name: explicitResourceName(config, 'frontend'), repository: config.hosting.repositoryUrl,
      platform: 'WEB', accessToken, buildSpec: FRONTEND_BUILD_SPEC,
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
