import React, { useEffect, useState } from 'react';
import { Icon } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface NotificationsModalProps {
    onClose: () => void;
}

interface Announcement {
    id: number;
    title?: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    created_at: string;
    user_id?: string | null;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ onClose }) => {
    const { showToast } = useToast();
    const [notifications, setNotifications] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);

    const { user } = useAuth();

    useEffect(() => {
        const fetchNotifications = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('announcements')
                    .select('*')
                    .eq('is_active', true)
                    .or(`user_id.is.null,user_id.eq.${user.id}`)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                // 1. Get DB Read Receipts (Persistent Cross-Device)
                let dbDismissedIds: number[] = [];
                const { data: dbReads, error: dbReadsError } = await supabase
                    .from('announcement_reads')
                    .select('announcement_id')
                    .eq('user_id', user.id);

                if (dbReads) {
                    dbDismissedIds = dbReads.map((r: any) => r.announcement_id);
                }

                // 2. Get Local Storage (Backup/Legacy)
                const storageKey = `dismissedAnnouncementIds_${user.id}`;
                const localDismissedIds = JSON.parse(localStorage.getItem(storageKey) || '[]');

                // 3. Merge: If read in DB OR Local, hide it
                const finalDismissedIds = [...new Set([...dbDismissedIds, ...localDismissedIds])];

                const activeNotifications = (data || []).filter(n => !finalDismissedIds.includes(n.id));

                setNotifications(activeNotifications);
            } catch (error) {
                console.error("Error fetching notifications:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchNotifications();
    }, [user]);

    const handleDismiss = async (notification: Announcement) => {
        if (!user) return;

        // 1. Optimistic Update UI
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
        showToast("Notificación eliminada", "success");
        window.dispatchEvent(new Event('notificationsUpdated'));

        // 2. Save to local storage (Immediate backup)
        try {
            const storageKey = `dismissedAnnouncementIds_${user.id}`;
            const dismissedIds = JSON.parse(localStorage.getItem(storageKey) || '[]');
            if (!dismissedIds.includes(notification.id)) {
                dismissedIds.push(notification.id);
                localStorage.setItem(storageKey, JSON.stringify(dismissedIds));
            }
        } catch (e) {
            console.error("Local storage error", e);
        }

        // 3. Persistent Save to DB
        try {
            // ALWAYS use the read-receipt table.
            // Editing the 'announcements' table (is_active=false) requires UPDATE permissions 
            // that regular users usually don't (and shouldn't) have.
            await supabase.from('announcement_reads').insert({
                user_id: user.id,
                announcement_id: notification.id
            });
        } catch (err) {
            console.error("Error syncing dismissal to DB:", err);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return 'check_circle';
            case 'warning': return 'warning';
            case 'error': return 'error';
            default: return 'notifications';
        }
    };

    const getColor = (type: string) => {
        switch (type) {
            case 'success': return 'text-green-500 bg-green-100';
            case 'warning': return 'text-orange-500 bg-orange-100';
            case 'error': return 'text-red-500 bg-red-100';
            default: return 'text-blue-500 bg-blue-100';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
                {/* Header */}
                <div className="relative p-6 pb-2 shrink-0 flex items-center justify-between border-b border-slate-100/50">
                    <div className="flex items-center gap-4">
                        <div className="size-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-500 shadow-sm">
                            <Icon name="notifications" size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">Notificaciones</h2>
                    </div>

                    <button
                        onClick={onClose}
                        className="size-8 rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-all"
                    >
                        <Icon name="close" size={20} />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="p-4 bg-slate-50 rounded-full mb-3">
                                <Icon name="notifications_off" size={32} className="text-slate-300" />
                            </div>
                            <p className="text-slate-400 font-medium">No tienes notificaciones nuevas</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {notifications.map((notification) => (
                                <motion.div
                                    key={notification.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex gap-4 group relative pr-10"
                                >
                                    <div className={`p-2 rounded-lg h-fit ${getColor(notification.type)}`}>
                                        <Icon name={getIcon(notification.type)} size={20} />
                                    </div>
                                    <div className="flex-1">
                                        {notification.title && (
                                            <h4 className="text-sm font-bold text-slate-900 mb-1">
                                                {notification.title}
                                            </h4>
                                        )}
                                        <p className="text-sm text-slate-600 leading-snug">
                                            {notification.message}
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-2 font-medium uppercase tracking-wide">
                                            {new Date(notification.created_at).toLocaleDateString('es-CL', {
                                                day: 'numeric',
                                                month: 'long',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>

                                    {/* Delete Button */}
                                    <button
                                        onClick={() => handleDismiss(notification)}
                                        className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors p-1"
                                        title="Eliminar notificación"
                                    >
                                        <Icon name="delete" size={18} />
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
