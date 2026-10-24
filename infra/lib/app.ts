import { App } from 'aws-cdk-lib';
import { loadEnvironmentConfig, resolveEnvironment } from './config/environment';
import { HireFluxStack } from './hireflux-stack';
import { verifyBackendArtifact, type BackendArtifact } from './backend/artifact';

export function composeEnvironment(app: App, artifact?: BackendArtifact): HireFluxStack {
  const selection: unknown = app.node.tryGetContext('environment');
  const environmentName = resolveEnvironment(selection);
  const accountBinding: unknown = app.node.tryGetContext(`${environmentName}Account`);
  const config = loadEnvironmentConfig(environmentName, accountBinding, app.node.tryGetContext('selfRegistrationEnabled'));
  const candidate: unknown = app.node.tryGetContext('backendArtifact');
  if (candidate !== undefined && (typeof candidate !== 'string' || !candidate.trim())) throw new Error('backendArtifact must name an explicit local candidate ZIP.');
  return new HireFluxStack(app, `HireFlux-${environmentName}`, config,
    artifact ?? (candidate === undefined ? undefined : verifyBackendArtifact(undefined, candidate as string)));
}
