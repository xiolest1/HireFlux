/** Public target types; data, validation and header policy share one pure contract. */
export interface PublicDeploymentBinding {
  environment: "staging" | "production";
  siteOrigin: string;
  apiOrigin: string;
  capabilities: readonly ("demo" | "cognito")[];
  cognito: { issuer: string; clientId: string; domain: string };
  callbackUrl: string;
  logoutUrl: string;
  selfRegistrationEnabled: boolean;
}
export type PublicDeploymentBindings = Readonly<Record<"staging" | "production", PublicDeploymentBinding | null>>;
export { exactOrigin, isLoopbackOrigin, resolvePublicDeployment, reviewedPublicDeployments, stagingPublicDeployment } from "./publicDeploymentPolicy.mjs";
