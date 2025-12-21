import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import LightRays from './LightRays';
import { NativeBiometric } from 'capacitor-native-biometric';

export const LoginView: React.FC = () => {
    const { signInWithGoogle } = useAuth();
    const [isRegistering, setIsRegistering] = useState(false);
    const [isRecovering, setIsRecovering] = useState(false);
    const [confirmationSent, setConfirmationSent] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [gender, setGender] = useState<'female' | 'male' | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [hasStoredCredentials, setHasStoredCredentials] = useState(false);

    // Dynamic rays color based on theme selection
    const raysColor = gender === 'male' ? '#2563eb' : gender === 'female' ? '#FF5CA0' : '#6366f1';

    // Apply theme on gender change (preview)
    const handleGenderSelect = (g: 'female' | 'male') => {
        setGender(g);
        document.body.classList.remove('theme-ocean', 'theme-pink');
        if (g === 'male') {
            document.body.classList.add('theme-ocean');
        } else if (g === 'female') {
            document.body.classList.add('theme-pink');
        }
    };

    // Check biometric on mount
    useEffect(() => {
        const checkBiometric = async () => {
            try {
                const result = await NativeBiometric.isAvailable();
                if (result.isAvailable) {
                    setBiometricAvailable(true);
                    // Check if we have saved credentials for this app
                    const hasCreds = localStorage.getItem('biometric_enabled') === 'true';
                    setHasStoredCredentials(hasCreds);
                }
            } catch (e) {
                console.log("Biometric not available", e);
            }
        };
        checkBiometric();
    }, []);

    const handleBiometricLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            // First, force the biometric prompt to appear
            await NativeBiometric.verifyIdentity({
                reason: 'Acceso a RegistBar',
                title: 'Inicio de Sesión',
                subtitle: 'Usa tu huella para acceder',
                description: 'Verifica tu identidad para entrar a RegistBar',
            });

            // If prompt is successful, retrieve the credentials
            const result = await NativeBiometric.getCredentials({
                server: 'com.registbar.app',
            });

            if (result.username && result.password) {
                const { error } = await supabase.auth.signInWithPassword({
                    email: result.username,
                    password: result.password
                });
                if (error) throw error;
            }
        } catch (err: any) {
            console.error("Biometric error:", err);
            // Don't show error if user cancelled
            if (err.message !== 'User cancelled') {
                setError("Error al autenticar con huella");
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: 'com.registbar.app://reset-password', // Deep Link for Android
            });
            if (error) throw error;
            setConfirmationSent(true);
        } catch (err: any) {
            setError(err.message || 'Error al enviar correo');
        } finally {
            setLoading(false);
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isRegistering) {
                // Sign Up
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            gender: gender, // Save gender
                            avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`,
                            theme: gender === 'male' ? 'ocean' : gender === 'female' ? 'pink' : 'default'
                        }
                    }
                });
                if (error) throw error;

                // Persist theme preference
                localStorage.setItem('theme', gender === 'male' ? 'ocean' : gender === 'female' ? 'pink' : 'default');

                // Show success view instead of alert
                setConfirmationSent(true);
            } else {
                // Sign In
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                if (error) throw error;
            }
        } catch (err: any) {
            setError(err.message || 'Ocurrió un error');
        } finally {
            setLoading(false);
        }
    };

    if (confirmationSent) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background-dark text-white px-6 text-center animate-fade-in-up">
                <div className="mb-8 p-6 bg-primary/10 rounded-full shadow-neon relative">
                    <Icon name="mail" size={64} className="text-primary" />
                    <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-1.5 border-4 border-background-dark">
                        <Icon name="check" size={16} className="text-white" />
                    </div>
                </div>

                <h2 className="text-2xl font-bold mb-3">¡Revisa tu bandeja!</h2>

                <p className="text-slate-400 mb-8 max-w-sm text-sm leading-relaxed">
                    Hemos enviado un enlace de confirmación a <br />
                    <span className="text-white font-medium text-base">{email}</span>.
                    <br /><br />
                    Para proteger tu seguridad, por favor valida tu cuenta haciendo clic en el enlace adjunto.
                </p>

                <button
                    onClick={() => {
                        setConfirmationSent(false);
                        setIsRegistering(false); // Return to login mode
                    }}
                    className="w-full max-w-xs bg-white/5 border border-white/10 text-white font-bold py-4 rounded-xl hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <Icon name="arrow_back" size={20} />
                    Volver al Inicio
                </button>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#0a0a0a] flex flex-col items-center justify-center px-6">
            {/* Light Rays Background Effect */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <LightRays
                    raysOrigin="top-center"
                    raysColor={raysColor}
                    raysSpeed={1.2}
                    lightSpread={0.8}
                    rayLength={1.7}
                    followMouse={true}
                    mouseInfluence={0.1}
                    noiseAmount={0.05}
                    distortion={0.03}
                />

                {/* Subtle overlay to soften the rays */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0a]/20 to-[#0a0a0a] z-[4]"></div>
            </div>

            <div className="relative z-10 w-full max-w-sm animate-fade-in-up">
                {/* Logo Area */}
                <div className="flex flex-col items-center mb-8 text-center">
                    <div className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl mb-4 animate-blob">
                        <Icon name="savings" size={48} className="text-primary drop-shadow-[0_0_15px_rgba(255,92,160,0.5)]" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">
                        {isRegistering ? 'Únete ahora' : 'Bienvenido'}
                    </h1>
                    <p className="text-slate-400 mt-2 text-sm font-medium">
                        {isRegistering
                            ? 'Lleva tus finanzas al siguiente nivel.'
                            : 'Tu gestión inteligente te espera.'}
                    </p>
                </div>

                {/* Main Auth Card */}
                <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">

                    {isRecovering ? (
                        <form onSubmit={handlePasswordReset} className="flex flex-col gap-4">
                            <div className="text-center mb-2">
                                <h3 className="text-white font-bold text-lg">Recuperar Acceso</h3>
                                <p className="text-slate-400 text-xs">Ingresa tu correo para recibir instrucciones.</p>
                            </div>

                            <div className="group relative">
                                <Icon name="mail" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="email"
                                    placeholder="Correo Institucional"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-medium"
                                />
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl text-center">
                                    {error}
                                </div>
                            )}

                            {confirmationSent ? (
                                <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs p-3 rounded-xl text-center">
                                    ¡Correo enviado! Revisa tu bandeja de entrada.
                                </div>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="mt-2 w-full bg-primary text-white font-extrabold py-4 rounded-2xl shadow-neon hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 text-lg"
                                >
                                    {loading ? (
                                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/30 border-t-white"></div>
                                    ) : (
                                        <>
                                            Enviar Enlace
                                            <Icon name="send" size={20} />
                                        </>
                                    )}
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => {
                                    setIsRecovering(false);
                                    setError(null);
                                    setConfirmationSent(false);
                                }}
                                className="mt-2 text-sm text-slate-500 hover:text-white transition-colors"
                            >
                                Volver al inicio
                            </button>
                        </form>
                    ) : (
                        <>
                            <form onSubmit={handleAuth} className="flex flex-col gap-4">

                                {isRegistering && (
                                    <>
                                        <div className="group relative">
                                            <Icon name="person" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" />
                                            <input
                                                type="text"
                                                placeholder="Nombre Completo"
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                                required
                                                className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-medium"
                                            />
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => handleGenderSelect('female')}
                                                className={`flex-1 py-3 rounded-2xl border flex items-center justify-center gap-2 transition-all ${gender === 'female' ? 'bg-pink-500 border-pink-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.4)] scale-105' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                                            >
                                                <Icon name="female" size={18} />
                                                <span className="text-xs font-bold uppercase tracking-wider">Mujer</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleGenderSelect('male')}
                                                className={`flex-1 py-3 rounded-2xl border flex items-center justify-center gap-2 transition-all ${gender === 'male' ? 'bg-cyan-600 border-cyan-600 text-white shadow-[0_0_20px_rgba(8,145,178,0.4)] scale-105' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                                            >
                                                <Icon name="male" size={18} />
                                                <span className="text-xs font-bold uppercase tracking-wider">Hombre</span>
                                            </button>
                                        </div>
                                    </>
                                )}

                                <div className="group relative">
                                    <Icon name="mail" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="email"
                                        placeholder="Correo Institucional"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-3.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-medium"
                                    />
                                </div>

                                <div className="group relative">
                                    <Icon name="lock" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Contraseña Segura"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-12 py-3.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-medium"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors focus:outline-none"
                                    >
                                        <Icon name={showPassword ? "visibility_off" : "visibility"} size={20} />
                                    </button>
                                </div>

                                {!isRegistering && (
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setIsRecovering(true)}
                                            className="text-xs text-slate-400 hover:text-white transition-colors font-medium"
                                        >
                                            ¿Olvidaste tu contraseña?
                                        </button>
                                    </div>
                                )}

                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl text-center">
                                        {error}
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
                                            {isRegistering ? 'Empezar ahora' : 'Acceder'}
                                            <Icon name="arrow_forward" size={20} />
                                        </>
                                    )}
                                </button>

                                {/* Biometric Login Component */}
                                {!isRegistering && biometricAvailable && hasStoredCredentials && (
                                    <button
                                        type="button"
                                        onClick={handleBiometricLogin}
                                        className="w-full mt-2 bg-white/5 border border-white/10 text-white font-bold py-4 rounded-2xl hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-3"
                                    >
                                        <div className="p-2 bg-primary/20 rounded-full">
                                            <Icon name="fingerprint" size={24} className="text-primary" />
                                        </div>
                                        Entrar con Huella
                                    </button>
                                )}
                            </form>

                            <div className="my-6 flex items-center w-full gap-4">
                                <div className="h-px bg-white/5 flex-1"></div>
                                <span className="text-[10px] text-slate-600 uppercase tracking-[0.2em] font-bold">O</span>
                                <div className="h-px bg-white/5 flex-1"></div>
                            </div>

                            <button
                                onClick={signInWithGoogle}
                                className="w-full bg-white text-slate-900 font-bold py-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all text-sm"
                            >
                                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                                Continuar con Google
                            </button>
                        </>
                    )} {/* Close isRecovering conditional */}
                </div>

                <p className="mt-8 text-center text-sm text-slate-500 font-medium">
                    {isRegistering ? '¿Ya eres miembro?' : '¿No tienes cuenta?'}
                    <button
                        onClick={() => setIsRegistering(!isRegistering)}
                        className="ml-2 text-primary font-bold hover:underline"
                    >
                        {isRegistering ? 'Inicia Sesión' : 'Crea una aquí'}
                    </button>
                </p>
            </div>
        </div>
    );
};
