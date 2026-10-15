import { create } from "zustand";
import type { ConnectedAccountSummary } from "@orbit/core";
import { fetchAccounts, deleteAccount as apiDeleteAccount, seedDemoData } from "../lib/api.js";
import { DEMO_ACCOUNT_ID } from "../lib/mock-data.js";

interface AccountState {
  accounts: ConnectedAccountSummary[];
  activeAccountId: string;
  isConnectModalOpen: boolean;
  isLoading: boolean;
  error: string | null;

  loadAccounts: () => Promise<void>;
  setActiveAccountId: (id: string) => void;
  setConnectModalOpen: (open: boolean) => void;
  removeAccount: (id: string) => Promise<void>;
  seedDemo: () => Promise<void>;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [
    {
      id: DEMO_ACCOUNT_ID,
      alias: "Production-AWS-Orbit (Demo)",
      provider: "aws",
      authMethod: "access_key",
      regions: ["us-east-1"],
      createdAt: new Date().toISOString(),
    },
  ],
  activeAccountId: DEMO_ACCOUNT_ID,
  isConnectModalOpen: false,
  isLoading: false,
  error: null,

  loadAccounts: async () => {
    try {
      set({ isLoading: true, error: null });
      const accounts = await fetchAccounts();
      if (accounts && accounts.length > 0) {
        set({
          accounts,
          activeAccountId: get().activeAccountId || accounts[0]?.id || DEMO_ACCOUNT_ID,
        });
      }
    } catch {
      // Keep demo account fallback active
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveAccountId: (id: string) => set({ activeAccountId: id }),
  setConnectModalOpen: (open: boolean) => set({ isConnectModalOpen: open }),

  removeAccount: async (id: string) => {
    try {
      await apiDeleteAccount(id);
      const remaining = get().accounts.filter((a) => a.id !== id);
      set({
        accounts: remaining,
        activeAccountId: remaining[0]?.id || DEMO_ACCOUNT_ID,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete account" });
    }
  },

  seedDemo: async () => {
    try {
      set({ isLoading: true });
      await seedDemoData();
      await get().loadAccounts();
      set({ activeAccountId: DEMO_ACCOUNT_ID });
    } catch {
      // Demo fallback in store already
    } finally {
      set({ isLoading: false });
    }
  },
}));
