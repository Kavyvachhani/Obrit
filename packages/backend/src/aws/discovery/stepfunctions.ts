import {
  SFNClient,
  ListStateMachinesCommand,
  DescribeStateMachineCommand,
} from "@aws-sdk/client-sfn";
import type { Resource, Edge } from "@orbit/core";
import { RESOURCE_TYPES } from "@orbit/core";
import { awsReadOnlyCall } from "../read-only-call.js";
import { withRateLimit } from "../rate-limiter.js";

export interface StepFunctionsDiscoveryResult {
  resources: Resource[];
  edges: Edge[];
}

export async function discoverStepFunctions(
  client: SFNClient,
  accountId: string,
  region: string
): Promise<StepFunctionsDiscoveryResult> {
  const resources: Resource[] = [];
  const edges: Edge[] = [];
  const now = new Date().toISOString();

  let nextToken: string | undefined;
  const stateMachines: Array<Record<string, unknown>> = [];

  do {
    const listRes = await withRateLimit("sfn", () =>
      awsReadOnlyCall<{
        stateMachines?: Array<Record<string, unknown>>;
        nextToken?: string;
      }>(
        client,
        new ListStateMachinesCommand({ nextToken }),
        "sfn",
        accountId
      )
    );

    if (listRes.stateMachines) {
      stateMachines.push(...listRes.stateMachines);
    }
    nextToken = listRes.nextToken;
  } while (nextToken);

  for (const sm of stateMachines) {
    const arn = sm["stateMachineArn"] as string;
    if (!arn) continue;
    const name = (sm["name"] as string) || arn.split(":").pop() || arn;

    let details: Record<string, unknown> = sm;
    try {
      const descRes = await withRateLimit("sfn", () =>
        awsReadOnlyCall<Record<string, unknown>>(
          client,
          new DescribeStateMachineCommand({ stateMachineArn: arn }),
          "sfn",
          accountId
        )
      );
      details = { ...sm, ...descRes };
    } catch {
      // Ignore detailed describe failure
    }

    resources.push({
      id: name,
      provider: "aws",
      accountId,
      region,
      type: RESOURCE_TYPES.STEP_FUNCTION,
      arn,
      name,
      tags: {},
      rawConfig: details,
      status: (details["status"] as string) === "ACTIVE" ? "healthy" : "unknown",
      lastSeenAt: now,
    });
  }

  return { resources, edges };
}
