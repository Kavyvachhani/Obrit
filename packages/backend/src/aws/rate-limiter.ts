import pino from "pino";

const logger = pino({ name: "rate-limiter" });

interface RateLimiterConfig {
  /** Max concurrent requests per service */
  maxConcurrency: number;
  /** Base delay in ms for exponential backoff */
  baseDelayMs: number;
  /** Maximum delay in ms for backoff */
  maxDelayMs: number;
  /** Maximum number of retries before giving up */
  maxRetries: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxConcurrency: 5,
  baseDelayMs: 200,
  maxDelayMs: 30_000,
  maxRetries: 5,
};

/** Per-service concurrency tracking */
const serviceConcurrency = new Map<string, number>();

/**
 * Wait until the service has capacity, then increment the counter.
 */
async function acquireSlot(service: string, maxConcurrency: number): Promise<void> {
  while ((serviceConcurrency.get(service) ?? 0) >= maxConcurrency) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  serviceConcurrency.set(service, (serviceConcurrency.get(service) ?? 0) + 1);
}

/**
 * Release a concurrency slot for the service.
 */
function releaseSlot(service: string): void {
  const current = serviceConcurrency.get(service) ?? 1;
  serviceConcurrency.set(service, Math.max(0, current - 1));
}

/**
 * Calculate delay with exponential backoff and jitter.
 */
function calculateDelay(attempt: number, config: RateLimiterConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * config.baseDelayMs;
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Check if an error is a throttling error from AWS.
 */
function isThrottleError(err: unknown): boolean {
  if (err && typeof err === "object") {
    const code = (err as Record<string, unknown>)["name"] as string | undefined;
    const throttleCodes = [
      "Throttling",
      "ThrottlingException",
      "RequestLimitExceeded",
      "TooManyRequestsException",
      "ProvisionedThroughputExceededException",
      "SlowDown",
    ];
    if (code && throttleCodes.includes(code)) return true;

    const statusCode = (err as Record<string, unknown>)["$metadata"] as
      | { httpStatusCode?: number }
      | undefined;
    if (statusCode?.httpStatusCode === 429) return true;
  }
  return false;
}

/**
 * Execute an AWS call with per-service concurrency limiting and exponential backoff.
 *
 * @param service - Service name for concurrency tracking (e.g., "ec2", "lambda")
 * @param fn - The async function to execute (should call awsReadOnlyCall internally)
 * @param config - Optional rate limiter configuration
 */
export async function withRateLimit<T>(
  service: string,
  fn: () => Promise<T>,
  config: Partial<RateLimiterConfig> = {}
): Promise<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  await acquireSlot(service, cfg.maxConcurrency);

  try {
    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (isThrottleError(err) && attempt < cfg.maxRetries) {
          const delay = calculateDelay(attempt, cfg);
          logger.warn(
            { service, attempt, delay },
            `Throttled by AWS, backing off ${delay}ms (attempt ${attempt + 1}/${cfg.maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw err;
        }
      }
    }
    // Should never reach here, but TypeScript needs it
    throw new Error(`Rate limiter: exhausted all retries for ${service}`);
  } finally {
    releaseSlot(service);
  }
}
