import React, { useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { LocalNotifications } from '@capacitor/local-notifications';

interface Announcement {
    id: number;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    is_active: boolean;
    created_at: string;
    user_id?: string | null;
}

export const AnnouncementListener: React.FC = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        // 1. Request Permissions on Mount
        const requestPermissions = async () => {
            try {
                const result = await LocalNotifications.requestPermissions();
                if (result.display !== 'granted') {
                    console.log('User denied notifications');
                }
            } catch (e) {
                console.error("Error requesting notifications", e);
            }
        };
        requestPermissions();

        // 2. Setup Realtime Subscription
        const channel = supabase
            .channel('public:announcements')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'announcements',
                },
                async (payload) => {
                    const newRecord = payload.new as any;

                    // Filter: Global OR targeted to this user
                    if (!newRecord.user_id || newRecord.user_id === user.id) {

                        // Schedule Local Notification
                        await LocalNotifications.schedule({
                            notifications: [
                                {
                                    title: newRecord.title || "Nueva Notificación",
                                    body: newRecord.message,
                                    id: newRecord.id, // ID must be integer? Supabase ID is bigint (number-like)
                                    schedule: { at: new Date(Date.now() + 1000) }, // 1 sec delay
                                    sound: undefined,
                                    attachments: undefined,
                                    actionTypeId: "",
                                    extra: null
                                }
                            ]
                        });

                        // Verify if read (Optimization: assume unread since it just arrived)
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Listening for announcements...');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    return null; // Headless component
};
