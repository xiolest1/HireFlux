import { validateEnvironmentConfig, type HireFluxEnvironmentConfig } from './environment';

// A conservative project convention, not a substitute for future service-specific validation.
export const MAX_EXPLICIT_NAME_LENGTH = 63;

export function explicitResourceName(config: HireFluxEnvironmentConfig, suffix: string): string {
  validateEnvironmentConfig(config);
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(suffix)) {
    throw new Error('Explicit name suffix must use lowercase letters, digits, and single hyphens.');
  }
  const name = `${config.resourceNamePrefix}-${suffix}`;
  if (name.length > MAX_EXPLICIT_NAME_LENGTH) {
    throw new Error(`Explicit HireFlux names must not exceed ${MAX_EXPLICIT_NAME_LENGTH} characters.`);
  }
  return name;
}
