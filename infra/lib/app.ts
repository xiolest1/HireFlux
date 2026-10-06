import { App } from 'aws-cdk-lib';
import { loadEnvironmentConfig, resolveEnvironment } from './config/environment';
import { HireFluxStack } from './hireflux-stack';
import type { BackendArtifact } from './backend/artifact';

export function composeEnvironment(app: App, artifact?: BackendArtifact): HireFluxStack {
  const selection: unknown = app.node.tryGetContext('environment');
  const environmentName = resolveEnvironment(selection);
  const accountBinding: unknown = app.node.tryGetContext(`${environmentName}Account`);
  const config = loadEnvironmentConfig(environmentName, accountBinding);
  return new HireFluxStack(app, `HireFlux-${environmentName}`, config, artifact);
}
