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

  // ─── Get attached policies for each role ─────────────────────────────────
  for (const role of allRoles) {
    const roleName = role["RoleName"] as string;
    const roleArn = role["Arn"] as string;

    let attachedPolicies: Array<{ PolicyName?: string; PolicyArn?: string }> = [];
    try {
      const policiesResult = await withRateLimit("iam", () =>
        awsReadOnlyCall<{
          AttachedPolicies?: Array<{ PolicyName?: string; PolicyArn?: string }>;
        }>(
          client,
          new ListAttachedRolePoliciesCommand({ RoleName: roleName }),
          "iam",
          accountId
        )
      );
      attachedPolicies = policiesResult.AttachedPolicies ?? [];
    } catch {
      // Non-fatal: some roles may have restricted policy listing
    }

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
