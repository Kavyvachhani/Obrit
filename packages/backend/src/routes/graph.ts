import type { FastifyInstance } from "fastify";
import { query } from "../db/client.js";
import type { GraphData, GraphNode, GraphLink } from "@orbit/core";

export async function graphRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/graph/:accountId — Return the full graph (nodes + links) for the renderer.
   * This is the main endpoint the frontend calls after a scan completes.
   */
  app.get<{ Params: { accountId: string } }>("/api/graph/:accountId", async (request, reply) => {
    const { accountId } = request.params;

    // Fetch all resources for this account
    const resourcesResult = await query<{
      id: string;
      provider: string;
      account_id: string;
      region: string;
      type: string;
      arn: string;
      name: string;
      tags: Record<string, string>;
      raw_config: Record<string, unknown>;
      status: string;
      last_seen_at: Date;
    }>("SELECT * FROM resources WHERE account_id = $1", [accountId]);

    // Fetch all edges for this account's latest scan
    const edgesResult = await query<{
      id: string;
      source_resource_id: string;
      target_resource_id: string;
      relationship_type: string;
    }>(
      `SELECT e.* FROM edges e
       INNER JOIN scan_runs sr ON e.scan_run_id = sr.id
       WHERE sr.account_id = $1
       ORDER BY sr.started_at DESC`,
      [accountId]
    );

    // Build a set of valid resource IDs for edge validation
    const validIds = new Set(resourcesResult.rows.map((r) => r.id));

    // Transform to GraphNode format
    const nodes: GraphNode[] = resourcesResult.rows.map((r) => {
      // Determine group (VPC ID) and subGroup (subnet/AZ) from edges or rawConfig
      let group: string | undefined;
      let subGroup: string | undefined;

      const rawConfig = r.raw_config;
      if (rawConfig) {
        // For resources that have a VpcId in their config, use it as group
        const vpcId = (rawConfig as Record<string, unknown>)["VpcId"] as string | undefined;
        if (vpcId) group = vpcId;

        // For resources with SubnetId, use it as subGroup
        const subnetId = (rawConfig as Record<string, unknown>)["SubnetId"] as string | undefined;
        if (subnetId) subGroup = subnetId;

        // For resources with AZ info
        const az = (rawConfig as Record<string, unknown>)["AvailabilityZone"] as string | undefined;
        if (az && !subGroup) subGroup = az;
      }

      // VPCs are their own group
      if (r.type === "vpc:vpc") {
        group = r.id;
      }

      return {
        id: r.id,
        provider: r.provider as "aws",
        accountId: r.account_id,
        region: r.region,
        type: r.type,
        arn: r.arn,
        name: r.name,
        tags: r.tags,
        rawConfig: r.raw_config,
        status: r.status as "healthy" | "degraded" | "unknown",
        lastSeenAt: r.last_seen_at.toISOString(),
        group,
        subGroup,
      };
    });

    // Transform to GraphLink format — only include edges where both endpoints exist
    const seenEdges = new Set<string>();
    const links: GraphLink[] = [];

    for (const e of edgesResult.rows) {
      const key = `${e.source_resource_id}--${e.relationship_type}--${e.target_resource_id}`;
      if (seenEdges.has(key)) continue;
      if (!validIds.has(e.source_resource_id) || !validIds.has(e.target_resource_id)) continue;

      seenEdges.add(key);
      links.push({
        id: e.id,
        sourceResourceId: e.source_resource_id,
        targetResourceId: e.target_resource_id,
        relationshipType: e.relationship_type,
        source: e.source_resource_id,
        target: e.target_resource_id,
      });
    }

    const graphData: GraphData = { nodes, links };
    return reply.send(graphData);
  });
}
