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

export const AWS_ALLOWED_ACTIONS: ReadonlySet<string> = new Set([
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
]);

/**
 * Check whether an AWS API action name is in the read-only allow-list.
 * This is a pure function — the enforcement wrapper lives in the backend.
 */
export function isAllowedAction(actionName: string): boolean {
  return AWS_ALLOWED_ACTIONS.has(actionName);
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
