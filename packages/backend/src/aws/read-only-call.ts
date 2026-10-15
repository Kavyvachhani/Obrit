import { isAllowedAction, isMutatingAction } from "@orbit/core";
import { logAuditEntry } from "../audit/logger.js";

/**
 * ReadOnlyViolationError — thrown when code attempts to call a non-allow-listed
 * AWS action. This is a hard stop, not a warning.
 */
export class ReadOnlyViolationError extends Error {
  constructor(action: string) {
    super(
      `BLOCKED: AWS action "${action}" is not in the read-only allow-list. ` +
        `Orbit is strictly read-only. Only Describe*/List*/Get* calls are permitted.`
    );
    this.name = "ReadOnlyViolationError";
  }
}

export interface AwsCommandLike {
  constructor: { name: string };
  input?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AwsClientLike {
  send: (command: any, options?: any) => Promise<any>;
  config?: any;
}

/**
 * The single gateway for all AWS API calls in the entire codebase.
 *
 * Every call goes through here. It:
 * 1. Extracts the action name from the SDK command class name
 * 2. Checks against the allow-list AND the mutating-prefix blocklist
 * 3. Throws ReadOnlyViolationError if the action isn't allowed
 * 4. Times the call and logs it to the audit trail
 * 5. Returns the result
 *
 * Usage:
 *   const result = await awsReadOnlyCall(ec2Client, new DescribeVpcsCommand({}), "ec2", accountId);
 */
export async function awsReadOnlyCall<TResult>(
  client: any,
  command: any,
  service: string,
  accountId: string
): Promise<TResult> {
  // Extract action name from command class: "DescribeVpcsCommand" → "DescribeVpcs"
  const commandName = command.constructor.name;
  const actionName = commandName.replace(/Command$/, "");

  // ─── HARD SAFETY CHECK ─────────────────────────────────────────────────
  // Belt: check against the explicit allow-list
  if (!isAllowedAction(actionName)) {
    throw new ReadOnlyViolationError(actionName);
  }

  // Suspenders: check against known mutating prefixes
  if (isMutatingAction(actionName)) {
    throw new ReadOnlyViolationError(actionName);
  }
  // ──────────────────────────────────────────────────────────────────────

  let region: string;
  try {
    region = await client.config.region();
  } catch {
    region = "unknown";
  }

  const startTime = Date.now();
  let success = true;
  let errorMessage: string | undefined;

  try {
    const result = await client.send(command);
    return result as TResult;
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    const durationMs = Date.now() - startTime;
    // Fire-and-forget audit logging — don't await to avoid slowing the scan
    void logAuditEntry({
      accountId,
      service,
      action: actionName,
      region,
      durationMs,
      success,
      errorMessage,
    });
  }
}
