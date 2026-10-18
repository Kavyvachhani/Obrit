import {
  CloudFrontClient,
  ListDistributionsCommand,
} from "@aws-sdk/client-cloudfront";
import type { Resource, Edge } from "@orbit/core";
import { RESOURCE_TYPES } from "@orbit/core";
import { awsReadOnlyCall } from "../read-only-call.js";
import { withRateLimit } from "../rate-limiter.js";

export interface CloudFrontDiscoveryResult {
  resources: Resource[];
  edges: Edge[];
}

export async function discoverCloudFront(
  client: CloudFrontClient,
  accountId: string,
  region: string
): Promise<CloudFrontDiscoveryResult> {
  const resources: Resource[] = [];
  const edges: Edge[] = [];
  const now = new Date().toISOString();

  let marker: string | undefined;
  const distributions: Array<Record<string, unknown>> = [];

  do {
    const listRes = await withRateLimit("cloudfront", () =>
      awsReadOnlyCall<{
        DistributionList?: {
          Items?: Array<Record<string, unknown>>;
          NextMarker?: string;
        };
      }>(
        client,
        new ListDistributionsCommand({ Marker: marker }),
        "cloudfront",
        accountId
      )
    );

    const distList = listRes.DistributionList;
    if (distList?.Items) {
      distributions.push(...distList.Items);
    }
    marker = distList?.NextMarker;
  } while (marker);

  for (const item of distributions) {
    const distId = item["Id"] as string;
    if (!distId) continue;
    const arn = (item["ARN"] as string) || `arn:aws:cloudfront::${accountId}:distribution/${distId}`;
    const domainName = (item["DomainName"] as string) || distId;
    const enabled = item["Enabled"] as boolean;

    resources.push({
      id: distId,
      provider: "aws",
      accountId,
      region: "global",
      type: RESOURCE_TYPES.CLOUDFRONT_DISTRIBUTION,
      arn,
      name: domainName,
      tags: {},
      rawConfig: item,
      status: enabled ? "healthy" : "unknown",
      lastSeenAt: now,
    });
  }

  return { resources, edges };
}
