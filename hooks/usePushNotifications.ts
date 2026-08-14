import { useEffect, useState } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../supabaseClient';
import { User } from '@supabase/supabase-js';

export const usePushNotifications = (user: User | null, onNotificationOpen?: () => void) => {
    const [fcmToken, setFcmToken] = useState<string | null>(null);

    const requestPushPermissions = async () => {
        if (Capacitor.getPlatform() === 'web') return false;

        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive === 'granted') {
            await PushNotifications.register();
            return true;
        }
        return false;
    };

    // Listeners setup on mount for native platforms
    useEffect(() => {
        if (Capacitor.getPlatform() === 'web') return;

        PushNotifications.addListener('registration', token => {
            console.log('FCM Token:', token.value);
            setFcmToken(token.value);
        });

        PushNotifications.addListener('registrationError', (error: any) => {
            console.warn('Error on push registration:', error);
        });

        PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
            console.log('Push received:', notification);
            const { title, body } = notification;
            alert(`🔔 Notificación:\n${title}\n${body}`);
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (notification: any) => {
            console.log('Push action performed:', notification);
            if (onNotificationOpen) {
                onNotificationOpen();
            }
        });

        return () => {
            PushNotifications.removeAllListeners();
        };
    }, [onNotificationOpen]);

    // Sync Token with Supabase (Multi-device support)
    useEffect(() => {
        const saveToken = async () => {
            if (user && fcmToken) {
                const { error } = await supabase
                    .from('user_devices')
                    .upsert({
                        user_id: user.id,
                        fcm_token: fcmToken,
                        device_type: Capacitor.getPlatform(),
                        last_used_at: new Date().toISOString()
                    }, { onConflict: 'fcm_token' });

                if (error) {
                    console.error('Error saving device token:', error);
                } else {
                    console.log('Device token synced with Supabase');
                }
            }
        };
        saveToken();
    }, [user, fcmToken]);

    return {
        fcmToken,
        requestPushPermissions
    };
};
