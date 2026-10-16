import {
  IAMClient,
  ListRolesCommand,
  ListAttachedRolePoliciesCommand,
} from "@aws-sdk/client-iam";
import type { Resource } from "@orbit/core";
import { RESOURCE_TYPES } from "@orbit/core";
import { awsReadOnlyCall } from "../read-only-call.js";
import { withRateLimit } from "../rate-limiter.js";

export interface IamDiscoveryResult {
  resources: Resource[];
}

export async function discoverIam(
  client: IAMClient,
  accountId: string
): Promise<IamDiscoveryResult> {
  const resources: Resource[] = [];
  const now = new Date().toISOString();

  // ─── List Roles (paginated) ──────────────────────────────────────────────
  let marker: string | undefined;
  const allRoles: Array<Record<string, unknown>> = [];

  do {
    const result = await withRateLimit("iam", () =>
      awsReadOnlyCall<{
        Roles?: Array<Record<string, unknown>>;
        Marker?: string;
        IsTruncated?: boolean;
      }>(
        client,
        new ListRolesCommand({ Marker: marker, MaxItems: 100 }),
        "iam",
        accountId
      )
    );
    allRoles.push(...(result.Roles ?? []));
    marker = result.IsTruncated ? (result.Marker as string) : undefined;
  } while (marker);

  // ─── Get attached policies (check top 25 roles to keep discovery instant) ───
  const policyLookupSlice = allRoles.slice(0, 25);
  const rolePolicyMap = new Map<string, Array<{ PolicyName?: string; PolicyArn?: string }>>();

  const chunkSize = 5;
  for (let i = 0; i < policyLookupSlice.length; i += chunkSize) {
    const chunk = policyLookupSlice.slice(i, i + chunkSize);
    await Promise.allSettled(
      chunk.map(async (role) => {
        const roleName = role["RoleName"] as string;
        try {
          const timeoutPromise = new Promise<{ AttachedPolicies?: Array<{ PolicyName?: string; PolicyArn?: string }> }>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 1500)
          );
          const callPromise = awsReadOnlyCall<{ AttachedPolicies?: Array<{ PolicyName?: string; PolicyArn?: string }> }>(
            client,
            new ListAttachedRolePoliciesCommand({ RoleName: roleName }),
            "iam",
            accountId
          );
          const policiesResult = await Promise.race([callPromise, timeoutPromise]);
          rolePolicyMap.set(roleName, policiesResult.AttachedPolicies ?? []);
        } catch {
          rolePolicyMap.set(roleName, []);
        }
      })
    );
  }

  for (const role of allRoles) {
    const roleName = role["RoleName"] as string;
    const roleArn = role["Arn"] as string;
    const attachedPolicies = rolePolicyMap.get(roleName) ?? [];

    resources.push({
      id: roleName,
      provider: "aws",
      accountId,
      region: "global", // IAM is global
      type: RESOURCE_TYPES.IAM_ROLE,
      arn: roleArn,
      name: roleName,
      tags: {},
      rawConfig: {
        ...role,
        AttachedPolicies: attachedPolicies,
      },
      status: "healthy",
      lastSeenAt: now,
    });
  }

  // IAM roles are global — no VPC/subnet edges
  return { resources };
}
