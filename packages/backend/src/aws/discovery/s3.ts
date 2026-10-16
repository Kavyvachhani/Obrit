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

  const allBuckets = bucketsResult.Buckets ?? [];
  const maxLocationLookups = 25; // Check location for up to 25 buckets to prevent scan hangs
  const bucketLookupSlice = allBuckets.slice(0, maxLocationLookups);

  // Parallel location lookups in chunks of 5 with 1.5s timeout per bucket
  const chunkSize = 5;
  const locationMap = new Map<string, string>();

  for (let i = 0; i < bucketLookupSlice.length; i += chunkSize) {
    const chunk = bucketLookupSlice.slice(i, i + chunkSize);
    await Promise.allSettled(
      chunk.map(async (bucket) => {
        const bucketName = bucket.Name;
        if (!bucketName) return;
        try {
          const timeoutPromise = new Promise<{ LocationConstraint?: string }>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 1500)
          );
          const callPromise = awsReadOnlyCall<{ LocationConstraint?: string }>(
            client,
            new GetBucketLocationCommand({ Bucket: bucketName }),
            "s3",
            accountId
          );
          const locationResult = await Promise.race([callPromise, timeoutPromise]);
          locationMap.set(bucketName, locationResult.LocationConstraint || "us-east-1");
        } catch {
          locationMap.set(bucketName, region || "us-east-1");
        }
      })
    );
  }

  for (const bucket of allBuckets) {
    const bucketName = bucket.Name;
    if (!bucketName) continue;

    const bucketRegion = locationMap.get(bucketName) || region || "us-east-1";

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

  return { resources };
}
