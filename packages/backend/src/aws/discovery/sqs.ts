import {
  SQSClient,
  ListQueuesCommand,
  GetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";
import type { Resource, Edge } from "@orbit/core";
import { RESOURCE_TYPES } from "@orbit/core";
import { awsReadOnlyCall } from "../read-only-call.js";
import { withRateLimit } from "../rate-limiter.js";

export interface SqsDiscoveryResult {
  resources: Resource[];
  edges: Edge[];
}

export async function discoverSqs(
  client: SQSClient,
  accountId: string,
  region: string
): Promise<SqsDiscoveryResult> {
  const resources: Resource[] = [];
  const edges: Edge[] = [];
  const now = new Date().toISOString();

  let nextToken: string | undefined;
  const queueUrls: string[] = [];

  do {
    const listRes = await withRateLimit("sqs", () =>
      awsReadOnlyCall<{
        QueueUrls?: string[];
        NextToken?: string;
      }>(
        client,
        new ListQueuesCommand({ NextToken: nextToken }),
        "sqs",
        accountId
      )
    );

    if (listRes.QueueUrls) {
      queueUrls.push(...listRes.QueueUrls);
    }
    nextToken = listRes.NextToken;
  } while (nextToken);

  for (const queueUrl of queueUrls) {
    const queueName = queueUrl.split("/").pop() || queueUrl;
    let arn = `arn:aws:sqs:${region}:${accountId}:${queueName}`;
    let attributes: Record<string, string> = {};

    try {
      const attrRes = await withRateLimit("sqs", () =>
        awsReadOnlyCall<{
          Attributes?: Record<string, string>;
        }>(
          client,
          new GetQueueAttributesCommand({
            QueueUrl: queueUrl,
            AttributeNames: ["All"],
          }),
          "sqs",
          accountId
        )
      );
      if (attrRes.Attributes) {
        attributes = attrRes.Attributes;
        if (attributes["QueueArn"]) {
          arn = attributes["QueueArn"];
        }
      }
    } catch {
      // Ignore attribute fetch error and use fallback ARN
    }

    resources.push({
      id: queueName,
      provider: "aws",
      accountId,
      region,
      type: RESOURCE_TYPES.SQS_QUEUE,
      arn,
      name: queueName,
      tags: {},
      rawConfig: { queueUrl, ...attributes },
      status: "healthy",
      lastSeenAt: now,
    });
  }

  return { resources, edges };
}
