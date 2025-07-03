import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SpendingHistoryEntry } from '@/lib/cashu';

// Define a pending transaction interface for lightning invoices
export interface PendingTransaction {
  id: string;
  direction: 'in' | 'out';
  amount: string;
  timestamp: number;
  status: 'pending';
  mintUrl: string;
  quoteId: string;
  paymentRequest: string;
}

interface TransactionHistoryStore {
  history: (SpendingHistoryEntry & { id: string })[];
  pendingTransactions: PendingTransaction[];

  // Add a new history entry to the store
  addHistoryEntry: (entry: SpendingHistoryEntry & { id: string }) => void;

  // Add a pending transaction
  addPendingTransaction: (transaction: PendingTransaction) => void;

  // Remove a pending transaction by id
  removePendingTransaction: (id: string) => void;

  // Get pending transactions
  getPendingTransactions: () => PendingTransaction[];

  // Get history entries, optionally filtered by direction
  getHistoryEntries: (direction?: 'in' | 'out') => (SpendingHistoryEntry & { id: string })[];

  // Get combined history - both confirmed and pending
  getCombinedHistory: () => (SpendingHistoryEntry & { id: string } | PendingTransaction)[];

  // Clear history entries for a specific user
  clearHistory: (pubkey?: string) => void;
}

export const useTransactionHistoryStore = create<TransactionHistoryStore>()(
  persist(
    (set, get) => ({
      history: [],
      pendingTransactions: [],

      addHistoryEntry(entry) {
        // Check if entry already exists
        const exists = get().history.some(item => item.id === entry.id);
        if (!exists) {
          set(state => ({
            history: [entry, ...state.history]
          }));
        }
      },

      addPendingTransaction(transaction) {
        // Check if transaction already exists
        const exists = get().pendingTransactions.some(item => item.id === transaction.id);
        if (!exists) {
          set(state => ({
            pendingTransactions: [transaction, ...state.pendingTransactions]
          }));
        }
      },

      removePendingTransaction(id) {
        set(state => ({
          pendingTransactions: state.pendingTransactions.filter(tx => tx.id !== id)
        }));
      },

      getPendingTransactions() {
        return get().pendingTransactions;
      },

      getHistoryEntries(direction) {
        const history = get().history;

        if (!direction) {
          // Return all entries sorted by timestamp (newest first)
          return [...history].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        }

        // Return filtered entries sorted by timestamp
        return history
          .filter(entry => entry.direction === direction)
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      },

      getCombinedHistory() {
        const history = get().history;
        const pending = get().pendingTransactions;

        // Combine and sort by timestamp (newest first)
        return [...history, ...pending].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      },

      clearHistory() {
        // Currently just clear all history
        set({ history: [], pendingTransactions: [] });
      },
    }),
    { name: 'cashu-history' },
  ),
) 