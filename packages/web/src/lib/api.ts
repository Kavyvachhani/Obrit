import type {
  GraphData,
  Resource,
  ScanRun,
  ConnectedAccountSummary,
  ConnectAccountRequest,
} from "@orbit/core";

const API_BASE =
  typeof window !== "undefined" && window.location.protocol === "file:"
    ? "http://127.0.0.1:4000/api"
    : "/api";

export async function fetchAccounts(): Promise<ConnectedAccountSummary[]> {
  const res = await fetch(`${API_BASE}/accounts`);
  if (!res.ok) throw new Error("Failed to fetch accounts");
  return res.json();
}

export async function connectAccount(data: ConnectAccountRequest): Promise<ConnectedAccountSummary> {
  const res = await fetch(`${API_BASE}/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Failed to connect account (${res.status})`);
  }
  return res.json();
}

export async function deleteAccount(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/accounts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete account");
}

export async function triggerScan(accountId: string): Promise<ScanRun> {
  const res = await fetch(`${API_BASE}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Scan failed (${res.status})`);
  }
  return res.json();
}

export async function fetchScanStatus(scanId: string): Promise<ScanRun> {
  const res = await fetch(`${API_BASE}/scan/${scanId}`);
  if (!res.ok) throw new Error("Failed to fetch scan status");
  return res.json();
}

export async function fetchGraph(accountId: string): Promise<GraphData> {
  const res = await fetch(`${API_BASE}/graph/${accountId}`);
  if (!res.ok) throw new Error("Failed to fetch graph data");
  return res.json();
}

export async function fetchResource(id: string): Promise<Resource> {
  const res = await fetch(`${API_BASE}/resources/${id}`);
  if (!res.ok) throw new Error("Failed to fetch resource details");
  return res.json();
}

export async function seedDemoData(): Promise<{
  account: { id: string; alias: string; region: string };
  scanRun: ScanRun;
  resourceCount: number;
  edgeCount: number;
}> {
  const res = await fetch(`${API_BASE}/demo/seed`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to seed demo data");
  return res.json();
}

export interface BillingServiceSummary {
  serviceName: string;
  shortName: string;
  mtdCost: number;
  estimatedMonthEndCost: number;
  resourcePrefixes: string[];
}

export interface BillingData {
  available: boolean;
  reason?: string;
  currency?: string;
  monthToDateTotal?: number;
  estimatedMonthEndTotal?: number;
  services?: BillingServiceSummary[];
}

export async function fetchBilling(accountId: string): Promise<BillingData> {
  const res = await fetch(`${API_BASE}/billing/${accountId}`, { credentials: "include" });
  if (!res.ok) {
    return { available: false, reason: "Billing data unavailable or permission not granted" };
  }
  return res.json();
}

export async function login(usernameOrPassword: string, maybePassword?: string): Promise<{ success: boolean; token?: string; user?: any }> {
  const body = maybePassword
    ? { username: usernameOrPassword, password: maybePassword }
    : { password: usernameOrPassword };

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Invalid credentials");
  }
  return res.json();
}

export async function register(username: string, password: string, email?: string): Promise<{ success: boolean; token?: string; user?: any }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password, email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Registration failed");
  }
  return res.json();
}

export async function loginAsGuest(): Promise<{ success: boolean; token?: string; user?: any }> {
  const res = await fetch(`${API_BASE}/auth/guest`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Failed to start guest session");
  }
  return res.json();
}

export async function checkAuth(): Promise<{ authenticated: boolean; user?: any }> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
    if (!res.ok) return { authenticated: false };
    return res.json();
  } catch {
    return { authenticated: false };
  }
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
}


