import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { CfnManagedLoginBranding, CfnUserPool, CfnUserPoolClient, CfnUserPoolDomain } from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import type { HireFluxEnvironmentConfig } from '../config/environment';

/** Four explicit resources, no custom resource, trigger, identity pool or SMS role. */
export class CognitoAuth extends Construct {
  readonly pool: CfnUserPool;
  readonly client: CfnUserPoolClient;
  readonly domain: CfnUserPoolDomain;
  readonly branding: CfnManagedLoginBranding;
  readonly origin: string;

  constructor(scope: Construct, id: string, config: HireFluxEnvironmentConfig, frontendOrigin: string) {
    super(scope, id);
    this.pool = new CfnUserPool(this, 'UserPool', {
      userPoolName: `${config.resourceNamePrefix}-accounts`, userPoolTier: 'ESSENTIALS',
      deletionProtection: 'ACTIVE', usernameAttributes: ['email'], autoVerifiedAttributes: ['email'],
      usernameConfiguration: { caseSensitive: false }, mfaConfiguration: 'OFF',
      adminCreateUserConfig: { allowAdminCreateUserOnly: !config.selfRegistrationEnabled },
      accountRecoverySetting: { recoveryMechanisms: [{ name: 'verified_email', priority: 1 }] },
      userAttributeUpdateSettings: { attributesRequireVerificationBeforeUpdate: ['email'] },
      emailConfiguration: { emailSendingAccount: 'COGNITO_DEFAULT' },
      schema: [{ name: 'email', attributeDataType: 'String', mutable: true, required: true }],
      policies: { passwordPolicy: { minimumLength: 12, requireLowercase: true, requireUppercase: true,
        requireNumbers: true, requireSymbols: true, temporaryPasswordValidityDays: 1 } },
    });
    this.pool.applyRemovalPolicy(RemovalPolicy.RETAIN);
    this.client = new CfnUserPoolClient(this, 'PublicClient', {
      userPoolId: this.pool.ref, clientName: `${config.resourceNamePrefix}-web`, generateSecret: false,
      allowedOAuthFlowsUserPoolClient: true, allowedOAuthFlows: ['code'],
      allowedOAuthScopes: ['openid', 'email', 'profile'], supportedIdentityProviders: ['COGNITO'],
      callbackUrLs: [`${frontendOrigin}/auth/callback`], logoutUrLs: [`${frontendOrigin}/auth/signed-out`],
      readAttributes: ['email', 'email_verified', 'name'], writeAttributes: ['email', 'name'],
      explicitAuthFlows: ['ALLOW_USER_SRP_AUTH'], preventUserExistenceErrors: 'ENABLED',
      accessTokenValidity: 60, idTokenValidity: 60, refreshTokenValidity: 1,
      tokenValidityUnits: { accessToken: 'minutes', idToken: 'minutes', refreshToken: 'days' },
      refreshTokenRotation: { feature: 'ENABLED', retryGracePeriodSeconds: 10 }, enableTokenRevocation: true,
    });
    const prefix = config.environmentName === 'staging'
      ? 'hireflux-staging-9465-use1-20261020'
      : `hireflux-production-${Stack.of(this).account}-use1-20261020`;
    this.origin = `https://${prefix}.auth.${config.awsRegion}.amazoncognito.com`;
    this.domain = new CfnUserPoolDomain(this, 'Domain', {
      userPoolId: this.pool.ref, domain: prefix, managedLoginVersion: 2,
    });
    this.branding = new CfnManagedLoginBranding(this, 'ManagedLoginBranding', {
      userPoolId: this.pool.ref, clientId: this.client.ref, useCognitoProvidedValues: true,
    });
    this.branding.addResourceDependency(this.domain);
  }
}
