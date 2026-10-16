import type {
  GraphData,
  Resource,
  ScanRun,
  ConnectedAccountSummary,
  ConnectAccountRequest,
} from "@orbit/core";

const API_BASE = "/api";

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
