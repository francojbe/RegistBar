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

        // Check active session with a safety timeout so it never hangs indefinitely
        const timeout = setTimeout(() => {
            setLoading((prev) => {
                if (prev) {
                    console.warn('Auth check reached safety timeout (3s), releasing loading state.');
                    return false;
                }
                return false;
            });
        }, 3000);

        const initAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    const { data: { user: freshUser }, error } = await supabase.auth.getUser();
                    if (freshUser && !error) {
                        const { data: profile } = await supabase.from('profiles').select('subscription_status').eq('id', freshUser.id).maybeSingle();
                        if (profile) {
                            freshUser.user_metadata = { ...freshUser.user_metadata, subscription_status: profile.subscription_status || 'free' };
                        }
                        setUser(freshUser);
                    }
                }
            } catch (err) {
                console.error('Error during initAuth:', err);
            } finally {
                clearTimeout(timeout);
                setLoading(false);
            }
        };

        initAuth();

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => {
            clearTimeout(timeout);
            subscription.unsubscribe();
        };
    }, []);

    const signInWithGoogle = async () => {
        try {
            if (!Capacitor.isNativePlatform()) {
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: window.location.origin
                    }
                });
                if (error) console.error('Error signing in:', error.message);
            } else {
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
        }
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('Error signing out:', error.message);
    };

    return (
        <AuthContext.Provider value={{ session, user, loading, signInWithGoogle, signOut }}>
            {loading ? (
                <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
                    <div className="p-4 bg-indigo-600/20 rounded-3xl mb-4 text-indigo-400 animate-pulse border border-indigo-500/20 shadow-lg">
                        <span className="material-symbols-outlined text-4xl">content_cut</span>
                    </div>
                    <div className="size-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs text-slate-400 font-semibold mt-3 tracking-wide">Cargando RegistBar...</p>
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};
