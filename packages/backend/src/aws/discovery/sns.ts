import {
  SNSClient,
  ListTopicsCommand,
  GetTopicAttributesCommand,
} from "@aws-sdk/client-sns";
import type { Resource, Edge } from "@orbit/core";
import { RESOURCE_TYPES } from "@orbit/core";
import { awsReadOnlyCall } from "../read-only-call.js";
import { withRateLimit } from "../rate-limiter.js";

export interface SnsDiscoveryResult {
  resources: Resource[];
  edges: Edge[];
}

export async function discoverSns(
  client: SNSClient,
  accountId: string,
  region: string
): Promise<SnsDiscoveryResult> {
  const resources: Resource[] = [];
  const edges: Edge[] = [];
  const now = new Date().toISOString();

  let nextToken: string | undefined;
  const topics: Array<{ TopicArn?: string }> = [];

  do {
    const listRes = await withRateLimit("sns", () =>
      awsReadOnlyCall<{
        Topics?: Array<{ TopicArn?: string }>;
        NextToken?: string;
      }>(
        client,
        new ListTopicsCommand({ NextToken: nextToken }),
        "sns",
        accountId
      )
    );

    if (listRes.Topics) {
      topics.push(...listRes.Topics);
    }
    nextToken = listRes.NextToken;
  } while (nextToken);

  for (const t of topics) {
    if (!t.TopicArn) continue;
    const topicArn = t.TopicArn;
    const topicName = topicArn.split(":").pop() || topicArn;
    let attributes: Record<string, string> = {};

    try {
      const attrRes = await withRateLimit("sns", () =>
        awsReadOnlyCall<{
          Attributes?: Record<string, string>;
        }>(
          client,
          new GetTopicAttributesCommand({ TopicArn: topicArn }),
          "sns",
          accountId
        )
      );
      if (attrRes.Attributes) {
        attributes = attrRes.Attributes;
      }
    } catch {
      // Ignore attribute fetch error
    }

    resources.push({
      id: topicName,
      provider: "aws",
      accountId,
      region,
      type: RESOURCE_TYPES.SNS_TOPIC,
      arn: topicArn,
      name: topicName,
      tags: {},
      rawConfig: attributes,
      status: "healthy",
      lastSeenAt: now,
    });
  }

  return { resources, edges };
}
