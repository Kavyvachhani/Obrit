import type { GraphNode, GraphLink } from "@orbit/core";

export function filterGraphData(
  nodes: GraphNode[],
  links: GraphLink[],
  category: "all" | "compute" | "network" | "database" | "storage" | "security",
  searchQuery: string
): { filteredNodes: GraphNode[]; filteredLinks: GraphLink[] } {
  const query = searchQuery.trim().toLowerCase();

  // 1. Filter by category
  let matchedNodes = nodes.filter((n) => {
    if (category === "all") return true;

    if (category === "network") {
      // Entire networking infrastructure
      return (
        n.type.startsWith("vpc:") ||
        n.type.startsWith("elb:") ||
        n.type.includes("security-group") ||
        n.type.includes("network-interface") ||
        n.type.includes("gateway")
      );
    }

    if (category === "compute") {
      // Compute resources + container subnets
      return (
        n.type.startsWith("ec2:instance") ||
        n.type.startsWith("lambda:") ||
        n.type === "vpc:subnet"
      );
    }

    if (category === "database") {
      // Databases + DB subnets
      return n.type.startsWith("rds:") || (n.type === "vpc:subnet" && n.name.toLowerCase().includes("db"));
    }

    if (category === "storage") {
      return n.type.startsWith("s3:");
    }

    if (category === "security") {
      return n.type.includes("security-group") || n.type.startsWith("iam:");
    }

    return true;
  });

  // 2. Filter by search query
  if (query) {
    matchedNodes = matchedNodes.filter(
      (n) =>
        n.name.toLowerCase().includes(query) ||
        n.id.toLowerCase().includes(query) ||
        n.type.toLowerCase().includes(query) ||
        n.arn.toLowerCase().includes(query) ||
        (n.group && n.group.toLowerCase().includes(query)) ||
        (n.subGroup && n.subGroup.toLowerCase().includes(query))
    );
  }

  // 3. Filter links connecting active nodes
  const activeIds = new Set(matchedNodes.map((n) => n.id));
  const filteredLinks = links.filter((l) => {
    const srcId = typeof l.source === "object" ? (l.source as GraphNode).id : (l.source as string);
    const tgtId = typeof l.target === "object" ? (l.target as GraphNode).id : (l.target as string);
    return activeIds.has(srcId) && activeIds.has(tgtId);
  });

  return { filteredNodes: matchedNodes, filteredLinks };
}
