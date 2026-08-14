import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { App as CapacitorApp } from '@capacitor/app';

export const usePasswordRecovery = () => {
    const [isPasswordReset, setIsPasswordReset] = useState(() => {
        return sessionStorage.getItem('recovery_mode') === 'true';
    });
    const [isCheckingRecovery, setIsCheckingRecovery] = useState(true);

    useEffect(() => {
        // 1. Check Web Hash on Mount
        if (window.location.hash && window.location.hash.includes('type=recovery')) {
            sessionStorage.setItem('recovery_mode', 'true');
            setIsPasswordReset(true);
        }
        setIsCheckingRecovery(false);

        // 2. Listen for Supabase Auth Recovery Events
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
            if (event === 'PASSWORD_RECOVERY') {
                sessionStorage.setItem('recovery_mode', 'true');
                setIsPasswordReset(true);
            }
        });

        // 3. Listen for Native Deep Links (Android/iOS)
        const setupDeepLinks = async () => {
            await CapacitorApp.removeAllListeners();

            CapacitorApp.addListener('appUrlOpen', async (data) => {
                try {
                    const urlStr = data.url;
                    if (urlStr.includes('reset-password') || urlStr.includes('type=recovery')) {
                        const url = new URL(urlStr);
                        const hash = url.hash.substring(1);
                        const params = new URLSearchParams(hash);
                        const accessToken = params.get('access_token');
                        const refreshToken = params.get('refresh_token');

                        if (accessToken && refreshToken) {
                            const { error } = await supabase.auth.setSession({
                                access_token: accessToken,
                                refreshToken: refreshToken
                            });
                            if (!error) {
                                sessionStorage.setItem('recovery_mode', 'true');
                                setIsPasswordReset(true);
                            }
                        }
                    } else if (urlStr.includes('action_complete')) {
                        await supabase.auth.signOut();
                        window.location.reload();
                    }
                } catch (e) {
                    console.error('Error handling deep link:', e);
                }
            });
        };

        setupDeepLinks();

        return () => {
            subscription.unsubscribe();
            CapacitorApp.removeAllListeners();
        };
    }, []);

    return {
        isPasswordReset,
        setIsPasswordReset,
        isCheckingRecovery
    };
};
