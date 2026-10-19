/**
 * AWS API Action Allow-List
 *
 * HARD RULE: Only Describe*, List*, and Get* actions are permitted.
 * No Create*, Put*, Modify*, Delete*, Update*, Terminate*, Attach*, or any
 * other mutating action is allowed — ever. The awsReadOnlyCall() wrapper in
 * the backend enforces this at runtime.
 *
 * This list is the single source of truth. If an action isn't here, it's blocked.
 */

export const CORE_ALLOWED_ACTIONS: string[] = [
  // ─── EC2 ─────────────────────────────────────────────────────────────────
  "DescribeVpcs",
  "DescribeSubnets",
  "DescribeRouteTables",
  "DescribeInternetGateways",
  "DescribeNatGateways",
  "DescribeSecurityGroups",
  "DescribeInstances",
  "DescribeNetworkInterfaces",

  // ─── Elastic Load Balancing v2 ───────────────────────────────────────────
  "DescribeLoadBalancers",
  "DescribeTargetGroups",
  "DescribeTargetHealth",

  // ─── Lambda ──────────────────────────────────────────────────────────────
  "ListFunctions",
  "GetFunction",

  // ─── RDS ─────────────────────────────────────────────────────────────────
  "DescribeDBInstances",
  "DescribeDBClusters",

  // ─── S3 ──────────────────────────────────────────────────────────────────
  "ListBuckets",
  "GetBucketLocation",

  // ─── IAM ─────────────────────────────────────────────────────────────────
  "ListRoles",
  "ListAttachedRolePolicies",

  // ─── DynamoDB ────────────────────────────────────────────────────────────
  "ListTables",
  "DescribeTable",

  // ─── SQS ─────────────────────────────────────────────────────────────────
  "ListQueues",
  "GetQueueAttributes",

  // ─── SNS ─────────────────────────────────────────────────────────────────
  "ListTopics",
  "GetTopicAttributes",

  // ─── API Gateway ─────────────────────────────────────────────────────────
  "GetRestApis",
  "GetApis",
  "GetStages",

  // ─── CloudFront ──────────────────────────────────────────────────────────
  "ListDistributions",
  "GetDistribution",

  // ─── ECS ─────────────────────────────────────────────────────────────────
  "ListClusters",
  "DescribeClusters",
  "ListServices",
  "DescribeServices",

  // ─── EKS ─────────────────────────────────────────────────────────────────
  "ListClusters",
  "DescribeCluster",

  // ─── Step Functions ──────────────────────────────────────────────────────
  "ListStateMachines",
  "DescribeStateMachine",

  // ─── ElastiCache ─────────────────────────────────────────────────────────
  "DescribeCacheClusters",
  "DescribeReplicationGroups",

  // ─── Cost Explorer (Unplanned Services Detector & Billing Forecast) ───────
  "GetCostAndUsage",
  "GetCostForecast",
  "GetDimensionValues",
];

const dynamicAllowedActions = new Set<string>(CORE_ALLOWED_ACTIONS);

export const AWS_ALLOWED_ACTIONS: ReadonlySet<string> = dynamicAllowedActions;

/**
 * Register additional read-only actions dynamically (extensible/config-driven).
 * Enforces that only Describe*, List*, and Get* actions can be registered.
 */
export function registerAllowedActions(actions: string[]): void {
  for (const action of actions) {
    if (/^(Describe|List|Get)[A-Z0-9]/.test(action) && !isMutatingAction(action)) {
      dynamicAllowedActions.add(action);
    } else {
      throw new Error(`Cannot register non-read-only action: ${action}`);
    }
  }
}

/**
 * Check whether an AWS API action name is in the read-only allow-list.
 * Supports registered actions and verifies read-only prefix.
 */
export function isAllowedAction(actionName: string): boolean {
  if (isMutatingAction(actionName)) return false;
  return dynamicAllowedActions.has(actionName);
}

/**
 * Known mutating prefixes — used for an additional safety grep / lint check.
 * Any SDK command whose name starts with one of these is unconditionally blocked.
 */
export const MUTATING_PREFIXES = [
  "Create",
  "Put",
  "Modify",
  "Delete",
  "Update",
  "Terminate",
  "Attach",
  "Detach",
  "Revoke",
  "Authorize",
  "Enable",
  "Disable",
  "Start",
  "Stop",
  "Reboot",
  "Run",
  "Send",
  "Invoke",
  "Tag",
  "Untag",
] as const;

/**
 * Returns true if the action name starts with a known mutating prefix.
 * Belt-and-suspenders check on top of the allow-list.
 */
export function isMutatingAction(actionName: string): boolean {
  return MUTATING_PREFIXES.some((prefix) => actionName.startsWith(prefix));
}
