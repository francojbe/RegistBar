import { db, LocalTransaction } from './db';
import { supabase } from './supabaseClient';
import { Transaction } from './types';

// Stable UUID fallback for non-secure (HTTP) or older environments
const generateUUID = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Standard RFC4122 v4 UUID fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Utility for formatting
const formatTransaction = (t: any): Transaction => ({
    id: t.id,
    title: t.title,
    // es-CL Chilean date formatting - Ensuring we treat as local/Santiago
    date: new Date(t.date).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' }),
    time: new Date(t.date).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit' }),
    amount: t.amount,
    type: t.type,
    category: t.category,
    icon: t.category === 'service' ? 'content_cut' : t.category === 'tip' ? 'savings' : (t.title && t.title.includes('Aporte a Ahorro')) ? 'savings' : 'shopping_bag',
    rawDate: t.date,
    gross_amount: t.gross_amount,
    commission_amount: t.commission_amount
});

export const OfflineService = {
    /**
     * Saves a transaction locally and attempts to sync it.
     */
    async saveTransaction(userId: string, payload: any) {
        // Generate a consistent ID for both local and cloud
        const id = generateUUID();
        const payloadWithId = { ...payload, id };

        let localId;
        try {
            // 1. Add to local queue (Dexie) - This is mandatory for offline-first
            localId = await db.transactions.add({
                user_id: userId,
                is_synced: 0,
                payload: payloadWithId,
                created_at: Date.now()
            });
        } catch (localErr) {
            console.error('Critical: Failed to save to local DB:', localErr);
            return { data: null, error: localErr };
        }

        // 2. Try to sync immediately
        try {
            const { data, error } = await supabase
                .from('transactions')
                .insert({
                  ...payloadWithId,
                  user_id: userId
                })
                .select()
                .single();

            if (!error && data) {
                // If success, update local record as synced
                await db.transactions.update(localId, { is_synced: 1 });
                return { data, error: null, offline: false };
            }
            
            // If Supabase returned an error (e.g. network or timeout), we don't treat it as a FAILURE 
            // for the user because we already saved it locally.
            console.warn('Supabase sync failed, item remains in local queue:', error);
            return { data: null, error: null, offline: true };
            
        } catch (err) {
            console.warn('Network exception while syncing, will sync later.', err);
            return { data: null, error: null, offline: true };
        }
    },

    /**
     * Synchronizes all unsynced local transactions to Supabase.
     */
    async syncPending(userId: string) {
        const pending = await db.transactions
            .where({ user_id: userId, is_synced: 0 })
            .toArray();

        if (pending.length === 0) return;

        console.log(`Syncing ${pending.length} pending transactions...`);

        for (const item of pending) {
            try {
                const { error } = await supabase
                    .from('transactions')
                    .insert({
                      ...item.payload,
                      user_id: userId
                    });

                // If success OR duplicate key error (means it's already there), mark as synced
                if (!error || error.code === '23505') { 
                    await db.transactions.update(item.id!, { is_synced: 1 });
                } else {
                    console.error('Supabase sync error:', error);
                    break; // Stop sync on other errors (like connection lost again)
                }
            } catch (err) {
                console.error('Individual sync exception:', err);
                break; // Stop if network is still down
            }
        }
    },

    /**
     * Gets transactions, prioritizing local unsynced ones + cloud ones.
     * If cloudTransactions is not provided, it fetches from Supabase.
     */
    async getFusedTransactions(userId: string, cloudTransactions?: Transaction[]): Promise<Transaction[]> {
        let fetchedCloud: Transaction[] = [];

        // Fetch ALL local items from Dexie to handle race status between local sync and cloud refresh
        const allLocal = await db.transactions
            .where({ user_id: userId })
            .toArray();

        const localMapped: Transaction[] = allLocal.map(p => {
            const f = formatTransaction(p.payload);
            return { ...f, isOfflinePending: p.is_synced === 0 }; // Label for UI if still pending
        });

        if (cloudTransactions !== undefined) {
             fetchedCloud = cloudTransactions;
        } else {
             try {
                 const { data, error } = await supabase
                     .from('transactions')
                     .select('*')
                     .eq('user_id', userId)
                     .order('date', { ascending: false });
                 
                 if (!error && data) {
                     fetchedCloud = data.map(formatTransaction);
                 }
             } catch (error) {
                 console.error('getFusedTransactions: Error fetching from cloud', error);
             }
        }

        // DE-DUPLICATION LOGIC (VITAL): 
        // We prioritize Cloud data, but keep Local data that HASN'T reached the cloud yet.
        // Even if marked as is_synced=1, if it's NOT in fetchedCloud, we show the local copy.
        const cloudIdSet = new Set(fetchedCloud.map(t => t.id));
        const missingLocals = localMapped.filter(l => !cloudIdSet.has(l.id));

        // Format: All Missing Locals + All Cloud
        const allFused = [...missingLocals, ...fetchedCloud];

        // Final sort by date (raw date) to ensure correct timeline
        return allFused.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());
    }
};
