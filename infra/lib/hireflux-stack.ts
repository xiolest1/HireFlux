import { RemovalPolicy, Stack, Tags } from 'aws-cdk-lib';
import { AttributeType, BillingMode, ProjectionType, Table, TableClass, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import type { Construct } from 'constructs';
import { validateEnvironmentConfig, type HireFluxEnvironmentConfig } from './config/environment';
import { BackendApi } from './backend/backend-api';
import { verifyBackendArtifact, type BackendArtifact } from './backend/artifact';
import type { Function } from 'aws-cdk-lib/aws-lambda';
import type { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';

export class HireFluxStack extends Stack {
  public readonly workspaceTable: Table;
  public readonly backend: BackendApi;
  public readonly backendFunction: Function;
  public readonly httpApi: HttpApi;

  constructor(scope: Construct, id: string, config: HireFluxEnvironmentConfig, artifact?: BackendArtifact) {
    validateEnvironmentConfig(config);
    super(scope, id, {
      stackName: config.stackName,
      env: {
        region: config.awsRegion,
        ...(config.awsAccount === undefined ? {} : { account: config.awsAccount }),
      },
      analyticsReporting: false,
      description: `HireFlux ${config.environmentName} backend request path (Phase 3D; not deployed).`,
    });

    for (const [key, value] of Object.entries(config.tags)) {
      Tags.of(this).add(key, value);
    }
    this.templateOptions.metadata = {
      HireFlux: {
        environmentName: config.environmentName,
        resourceNamePrefix: config.resourceNamePrefix,
        awsRegion: config.awsRegion,
        accountBinding: config.awsAccount === undefined ? 'unbound' : 'explicit',
      },
    };
    // Stateful identity contract: renaming/reparenting WorkspaceTable requires migration review.
    this.workspaceTable = new Table(this, 'WorkspaceTable', {
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      sortKey: { name: 'SK', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      tableClass: TableClass.STANDARD,
      encryption: TableEncryption.DEFAULT,
      timeToLiveAttribute: 'expires_at',
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: config.data.pointInTimeRecovery },
      deletionProtection: config.data.deletionProtection,
      removalPolicy: RemovalPolicy[config.data.removalPolicy],
    });
    for (const indexName of ['GSI1', 'GSI2', 'GSI3']) {
      this.workspaceTable.addGlobalSecondaryIndex({
        indexName,
        partitionKey: { name: `${indexName}PK`, type: AttributeType.STRING },
        sortKey: { name: `${indexName}SK`, type: AttributeType.STRING },
        projectionType: ProjectionType.ALL,
      });
    }
    this.backend = new BackendApi(this, 'BackendApi', this.workspaceTable, config, artifact ?? verifyBackendArtifact());
    this.backendFunction = this.backend.backendFunction;
    this.httpApi = this.backend.httpApi;
  }
}
