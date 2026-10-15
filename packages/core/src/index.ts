// @orbit/core — Shared types, constants, and utilities
// Zero runtime dependencies. Consumed by both backend and frontend.

export type {
  Provider,
  AuthMethod,
  ResourceStatus,
  Resource,
  LiveMetric,
  Edge,
  GraphNode,
  GraphLink,
  GraphData,
  ScanStatus,
  ScanError,
  ScanRun,
  ConnectedAccount,
  ConnectAccountRequest,
  ConnectedAccountSummary,
} from "./models/resource.js";

export {
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
  RESOURCE_TYPE_COLORS,
  RELATIONSHIP_TYPES,
} from "./constants/resource-types.js";

export type { ResourceType, RelationshipType } from "./constants/resource-types.js";

export {
  AWS_ALLOWED_ACTIONS,
  isAllowedAction,
  isMutatingAction,
  MUTATING_PREFIXES,
} from "./constants/aws-actions.js";

export { buildConsoleLink, AWS_REGIONS } from "./utils/console-links.js";
