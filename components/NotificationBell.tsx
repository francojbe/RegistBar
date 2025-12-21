import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationBellProps {
    onClick: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onClick }) => {
    const { user } = useAuth();
    const [count, setCount] = useState(0);

    const fetchCount = async () => {
        if (!user) return;

        try {
            // 1. Get all active announcements targeted at user
            const { data: announcements, error } = await supabase
                .from('announcements')
                .select('id')
                .eq('is_active', true)
                .or(`user_id.is.null,user_id.eq.${user.id}`);

            if (error) throw error;
            if (!announcements) return setCount(0);

            // 2. Get DB Read Receipts (Persistent)
            let dbDismissedIds: number[] = [];
            const { data: dbReads } = await supabase
                .from('announcement_reads')
                .select('announcement_id')
                .eq('user_id', user.id);

            if (dbReads) {
                dbDismissedIds = dbReads.map((r: any) => r.announcement_id);
            }

            // 3. Get Local Storage (Backup)
            const storageKey = `dismissedAnnouncementIds_${user.id}`;
            const localDismissedIds = JSON.parse(localStorage.getItem(storageKey) || '[]');

            // 4. Merge dismissed lists
            const finalDismissedIds = [...new Set([...dbDismissedIds, ...localDismissedIds])];

            // 5. Calculate real active count
            const activeCount = announcements.filter(n => !finalDismissedIds.includes(n.id)).length;

            setCount(activeCount);
        } catch (error) {
            console.error("Error fetching notification count:", error);
        }
    };

    // Poll for notifications every 30 seconds
    useEffect(() => {
        fetchCount();
        const interval = setInterval(fetchCount, 30000);
        return () => clearInterval(interval);
    }, [user]);

    // Listen for custom event when modal is closed/updated
    useEffect(() => {
        const handleUpdate = () => fetchCount();
        window.addEventListener('notificationsUpdated', handleUpdate);
        return () => window.removeEventListener('notificationsUpdated', handleUpdate);
    }, [user]);

    return (
        <button
            onClick={onClick}
            className="relative size-10 rounded-full bg-white shadow-soft hover:shadow-lg transition-all active:scale-95 flex items-center justify-center text-slate-700"
            title="Notificaciones"
        >
            <Icon name="notifications" size={20} />

            <AnimatePresence>
                {count > 0 && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="absolute top-0 right-0 size-5 bg-red-500 rounded-full border-2 border-slate-50 flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                    >
                        {count > 9 ? '9+' : count}
                    </motion.span>
                )}
            </AnimatePresence>
        </button>
    );
};
