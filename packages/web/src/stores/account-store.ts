import { create } from "zustand";
import type { ConnectedAccountSummary } from "@orbit/core";
import { fetchAccounts, deleteAccount as apiDeleteAccount } from "../lib/api.js";

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
}

const STORAGE_KEY = "orbit_active_account_id";

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  activeAccountId: typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) || "" : "",
  isConnectModalOpen: false,
  isLoading: false,
  error: null,

  loadAccounts: async () => {
    try {
      set({ isLoading: true, error: null });
      const accounts = await fetchAccounts();
      if (accounts && accounts.length > 0) {
        const storedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        const matched = storedId && accounts.some((a) => a.id === storedId);
        const nextActiveId = matched ? storedId : (storedId === "demo" ? "demo" : accounts[0]?.id || "");
        
        set({
          accounts,
          activeAccountId: nextActiveId,
        });
      } else {
        set({
          accounts: [],
          activeAccountId: get().activeAccountId === "demo" ? "demo" : "",
        });
      }
    } catch {
      // Keep existing state on network error
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveAccountId: (id: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
    }
    set({ activeAccountId: id });
  },

  setConnectModalOpen: (open: boolean) => set({ isConnectModalOpen: open }),

  removeAccount: async (id: string) => {
    try {
      await apiDeleteAccount(id);
      const remaining = get().accounts.filter((a) => a.id !== id);
      const nextActive = remaining[0]?.id || "demo";
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, nextActive);
      }
      set({
        accounts: remaining,
        activeAccountId: nextActive,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete account" });
    }
  },
}));
