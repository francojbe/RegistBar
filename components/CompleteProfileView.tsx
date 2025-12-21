import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Icon } from './Icons';
import LightRays from './LightRays';

export const CompleteProfileView: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [selectedGender, setSelectedGender] = useState<'male' | 'female' | null>(null);

    const handleUpdateProfile = async (gender: 'male' | 'female') => {
        setLoading(true);
        setSelectedGender(gender);

        // Preview theme immediately for better UX
        document.body.classList.remove('theme-ocean', 'theme-pink');
        if (gender === 'male') document.body.classList.add('theme-ocean');
        if (gender === 'female') document.body.classList.add('theme-pink');

        try {
            const { error } = await supabase.auth.updateUser({
                data: {
                    gender: gender,
                    theme: gender === 'male' ? 'ocean' : 'pink'
                }
            });

            if (error) throw error;

            // The AuthContext will automatically detect the user update 
            // and App.tsx will re-render, showing the main app.

        } catch (error) {
            console.error('Error updating profile:', error);
            setLoading(false);
            setSelectedGender(null); // Reset on error
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#0a0a0a] flex flex-col items-center justify-center px-6">
            {/* Background Effect */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <LightRays
                    raysOrigin="top-center"
                    raysColor={selectedGender === 'male' ? '#2563eb' : selectedGender === 'female' ? '#FF5CA0' : '#6366f1'}
                    raysSpeed={1.5}
                    lightSpread={0.8}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0a]/50 to-[#0a0a0a] z-[4]"></div>
            </div>

            <div className="relative z-10 w-full max-w-sm text-center animate-fade-in-up">
                <div className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl mb-8 inline-block">
                    <Icon name="person" size={48} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                </div>

                <h1 className="text-3xl font-extrabold text-white tracking-tight mb-3">
                    ¡Casi listo!
                </h1>
                <p className="text-slate-400 mb-10 text-lg">
                    Ayúdanos a personalizar tu experiencia.
                </p>

                <div className="flex flex-col gap-4">
                    <button
                        onClick={() => handleUpdateProfile('female')}
                        disabled={loading}
                        className="group relative w-full bg-white/5 border border-white/10 hover:bg-pink-500/20 hover:border-pink-500/50 hover:shadow-[0_0_30px_rgba(236,72,153,0.3)] transition-all duration-300 p-6 rounded-3xl flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-pink-500/20 rounded-full text-pink-400 group-hover:bg-pink-500 group-hover:text-white transition-colors">
                                <Icon name="female" size={24} />
                            </div>
                            <div className="text-left">
                                <h3 className="text-white font-bold text-lg">Mujer</h3>
                                <p className="text-slate-400 text-sm group-hover:text-pink-200">Tema Aurora Pink</p>
                            </div>
                        </div>
                        <Icon name="arrow_forward" size={20} className="text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </button>

                    <button
                        onClick={() => handleUpdateProfile('male')}
                        disabled={loading}
                        className="group relative w-full bg-white/5 border border-white/10 hover:bg-cyan-600/20 hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(8,145,178,0.3)] transition-all duration-300 p-6 rounded-3xl flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-cyan-500/20 rounded-full text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                                <Icon name="male" size={24} />
                            </div>
                            <div className="text-left">
                                <h3 className="text-white font-bold text-lg">Hombre</h3>
                                <p className="text-slate-400 text-sm group-hover:text-cyan-200">Tema Ocean Blue</p>
                            </div>
                        </div>
                        <Icon name="arrow_forward" size={20} className="text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </button>
                </div>

                {loading && (
                    <div className="mt-8 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                    </div>
                )}
            </div>
        </div>
    );
};
