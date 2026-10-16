import {
  LambdaClient,
  ListFunctionsCommand,
  GetFunctionCommand,
} from "@aws-sdk/client-lambda";
import type { Resource, Edge } from "@orbit/core";
import { RESOURCE_TYPES, RELATIONSHIP_TYPES } from "@orbit/core";
import { awsReadOnlyCall } from "../read-only-call.js";
import { withRateLimit } from "../rate-limiter.js";

export interface LambdaDiscoveryResult {
  resources: Resource[];
  edges: Edge[];
}

export async function discoverLambda(
  client: LambdaClient,
  accountId: string,
  region: string
): Promise<LambdaDiscoveryResult> {
  const resources: Resource[] = [];
  const edges: Edge[] = [];
  const now = new Date().toISOString();

  // ─── List Functions ──────────────────────────────────────────────────────
  let marker: string | undefined;
  const allFunctions: Array<Record<string, unknown>> = [];

  do {
    const result = await withRateLimit("lambda", () =>
      awsReadOnlyCall<{
        Functions?: Array<Record<string, unknown>>;
        NextMarker?: string;
      }>(
        client,
        new ListFunctionsCommand({ Marker: marker }),
        "lambda",
        accountId
      )
    );
    allFunctions.push(...(result.Functions ?? []));
    marker = result.NextMarker;
  } while (marker);

  // ─── Process Functions (VpcConfig and metadata are already included in ListFunctions) ──
  for (const fn of allFunctions) {
    const functionName = fn["FunctionName"] as string;
    const functionArn = fn["FunctionArn"] as string;
    const detailedConfig: Record<string, unknown> = fn;

    resources.push({
      id: functionName,
      provider: "aws",
      accountId,
      region,
      type: RESOURCE_TYPES.LAMBDA_FUNCTION,
      arn: functionArn,
      name: functionName,
      tags: {},
      rawConfig: detailedConfig,
      status: (detailedConfig["State"] as string) === "Active" ? "healthy" : "unknown",
      lastSeenAt: now,
    });

    // Edge: Lambda → VPC/Subnets (runs-in, if VPC-attached)
    const vpcConfig = detailedConfig["VpcConfig"] as
      | { VpcId?: string; SubnetIds?: string[]; SecurityGroupIds?: string[] }
      | undefined;

    if (vpcConfig?.VpcId) {
      edges.push({
        id: `${functionName}--${RELATIONSHIP_TYPES.RUNS_IN}--${vpcConfig.VpcId}`,
        sourceResourceId: functionName,
        targetResourceId: vpcConfig.VpcId,
        relationshipType: RELATIONSHIP_TYPES.RUNS_IN,
      });

      for (const subnetId of vpcConfig.SubnetIds ?? []) {
        edges.push({
          id: `${functionName}--${RELATIONSHIP_TYPES.RUNS_IN}--${subnetId}`,
          sourceResourceId: functionName,
          targetResourceId: subnetId,
          relationshipType: RELATIONSHIP_TYPES.RUNS_IN,
        });
      }

      for (const sgId of vpcConfig.SecurityGroupIds ?? []) {
        edges.push({
          id: `${functionName}--${RELATIONSHIP_TYPES.MEMBER_OF}--${sgId}`,
          sourceResourceId: functionName,
          targetResourceId: sgId,
          relationshipType: RELATIONSHIP_TYPES.MEMBER_OF,
        });
      }
    }
  }

  return { resources, edges };
}
