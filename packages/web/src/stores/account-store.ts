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

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  activeAccountId: "",
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
          activeAccountId: get().activeAccountId || accounts[0]?.id || "",
          isConnectModalOpen: false,
        });
      } else {
        set({
          accounts: [],
          activeAccountId: "",
          isConnectModalOpen: false,
        });
      }
    } catch {
      set({
        accounts: [],
        activeAccountId: "",
        isConnectModalOpen: false,
      });
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
        activeAccountId: remaining[0]?.id || "",
        isConnectModalOpen: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete account" });
    }
  },
}));
