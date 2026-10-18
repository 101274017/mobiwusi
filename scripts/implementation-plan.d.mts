export interface ImplementationPlanSource {
  path: string;
  exists: boolean;
  text: string;
  bytes: number;
  contentSha256: string | null;
}
export function readImplementationPlan(rootDirectory: string): ImplementationPlanSource;
