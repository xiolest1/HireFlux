import type { Plugin } from "vite";
export function selectPublicContract(contract: object, siteOrigin: string, apiOrigin: string): object;
export function publicDeploymentProjection(options: { siteOrigin: string; apiOrigin: string; contract?: object }): Plugin;
