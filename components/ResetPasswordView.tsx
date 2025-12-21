import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Icon } from './Icons';
import LightRays from './LightRays';

export const ResetPasswordView: React.FC = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setMessage({ text: 'Las contraseñas no coinciden', type: 'error' });
            return;
        }

        if (password.length < 6) {
            setMessage({ text: 'La contraseña debe tener al menos 6 caracteres', type: 'error' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            setMessage({ text: '¡Contraseña actualizada con éxito!', type: 'success' });

            // Clear recovery mode
            sessionStorage.removeItem('recovery_mode');

            // Redirect to App (Mobile) or Home (Web)
            setTimeout(() => {
                const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

                if (isMobile) {
                    // Try to open the Native App
                    window.location.href = 'com.registbar.app://';

                    // Fallback to web login if app fails to open
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 2500);
                } else {
                    window.location.href = '/';
                }
            }, 1000);

        } catch (error: any) {
            setMessage({ text: error.message || 'Error al actualizar contraseña', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#0a0a0a] flex flex-col items-center justify-center px-6">
            <div className="relative z-10 w-full max-w-sm animate-fade-in-up">
                <div className="flex flex-col items-center mb-8 text-center">
                    <div className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl mb-4">
                        <Icon name="lock_reset" size={48} className="text-primary" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">
                        Nueva Contraseña
                    </h1>
                    <p className="text-slate-400 mt-2 text-sm font-medium">
                        Crea una contraseña segura para tu cuenta.
                    </p>
                </div>

                <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
                    <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
                        <div className="group relative">
                            <Icon name="lock" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" />
                            <input
                                type="password"
                                placeholder="Nueva Contraseña"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-medium"
                            />
                        </div>

                        <div className="group relative">
                            <Icon name="lock_clock" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" />
                            <input
                                type="password"
                                placeholder="Confirmar Contraseña"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-medium"
                            />
                        </div>

                        {message && (
                            <div className={`text-xs p-3 rounded-xl text-center border ${message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                {message.text}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-4 w-full bg-primary text-white font-extrabold py-4 rounded-2xl shadow-neon hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 text-lg"
                        >
                            {loading ? (
                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/30 border-t-white"></div>
                            ) : (
                                <>
                                    Actualizar
                                    <Icon name="check_circle" size={20} />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
