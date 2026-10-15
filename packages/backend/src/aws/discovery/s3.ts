import {
  S3Client,
  ListBucketsCommand,
  GetBucketLocationCommand,
} from "@aws-sdk/client-s3";
import type { Resource } from "@orbit/core";
import { RESOURCE_TYPES } from "@orbit/core";
import { awsReadOnlyCall } from "../read-only-call.js";
import { withRateLimit } from "../rate-limiter.js";

export interface S3DiscoveryResult {
  resources: Resource[];
}

export async function discoverS3(
  client: S3Client,
  accountId: string,
  region: string
): Promise<S3DiscoveryResult> {
  const resources: Resource[] = [];
  const now = new Date().toISOString();

  // ─── List Buckets (global, account-level) ────────────────────────────────
  const bucketsResult = await withRateLimit("s3", () =>
    awsReadOnlyCall<{ Buckets?: Array<{ Name?: string; CreationDate?: Date }> }>(
      client,
      new ListBucketsCommand({}),
      "s3",
      accountId
    )
  );

  for (const bucket of bucketsResult.Buckets ?? []) {
    const bucketName = bucket.Name;
    if (!bucketName) continue;

    // Get bucket location to determine its actual region
    let bucketRegion = region;
    try {
      const locationResult = await withRateLimit("s3", () =>
        awsReadOnlyCall<{ LocationConstraint?: string }>(
          client,
          new GetBucketLocationCommand({ Bucket: bucketName }),
          "s3",
          accountId
        )
      );
      // null/empty LocationConstraint means us-east-1
      bucketRegion = locationResult.LocationConstraint || "us-east-1";
    } catch {
      // Fall back to the account region if we can't get the location
    }

    resources.push({
      id: bucketName,
      provider: "aws",
      accountId,
      region: bucketRegion,
      type: RESOURCE_TYPES.S3_BUCKET,
      arn: `arn:aws:s3:::${bucketName}`,
      name: bucketName,
      tags: {},
      rawConfig: {
        Name: bucketName,
        CreationDate: bucket.CreationDate?.toISOString(),
        Region: bucketRegion,
      },
      status: "healthy",
      lastSeenAt: now,
    });
  }

  // S3 buckets are global — no edges to VPCs/subnets
  return { resources };
}
