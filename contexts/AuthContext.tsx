import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    loading: true,
    signInWithGoogle: async () => { },
    signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Init Google Auth
        const initGoogleAuth = async () => {
            if (Capacitor.isNativePlatform()) {
                await GoogleAuth.initialize({
                    clientId: '507498495844-a6t102dmlfh4tffgj8o8f61uls2oc8n0.apps.googleusercontent.com',
                    scopes: ['profile', 'email'],
                    grantOfflineAccess: true,
                });
            }
        };
        initGoogleAuth();

        // Check active session
        const initAuth = async () => {
            // 1. Get session from local storage (Fast)
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            setUser(session?.user ?? null);

            // 2. Fetch fresh user data from server (Ensure up-to-date metadata)
            if (session?.user) {
                const { data: { user: freshUser }, error } = await supabase.auth.getUser();
                if (freshUser && !error) {
                    // Check Subscription in DB
                    const { data: profile } = await supabase.from('profiles').select('subscription_status').eq('id', freshUser.id).single();
                    if (profile) {
                        // Merge subscription_status into user metadata for easier access app-wide without refetching constantly
                        freshUser.user_metadata = { ...freshUser.user_metadata, subscription_status: profile.subscription_status || 'free' };
                    }
                    setUser(freshUser);
                }
            }

            setLoading(false);
        };

        initAuth();

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session);
            // If the event is USER_UPDATED, session.user might be up to date, 
            // but explicitly setting it from session is usually safe.
            // However, just to be super sure on updates:
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        try {
            // Use isNativePlatform() for more robust check
            if (!Capacitor.isNativePlatform()) {
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: window.location.origin
                    }
                });
                if (error) console.error('Error signing in:', error.message);
            } else {
                // Native Login (Android/iOS)
                const googleUser = await GoogleAuth.signIn();

                if (googleUser.authentication.idToken) {
                    const { error } = await supabase.auth.signInWithIdToken({
                        provider: 'google',
                        token: googleUser.authentication.idToken,
                    });
                    if (error) throw error;
                } else {
                    throw new Error('No ID Token returned from Google');
                }
            }
        } catch (error: any) {
            console.error('Error signing in with Google:', error);
            // Optionally show a toast/alert here
        }
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('Error signing out:', error.message);
    };

    return (
        <AuthContext.Provider value={{ session, user, loading, signInWithGoogle, signOut }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
