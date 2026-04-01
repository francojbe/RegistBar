import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import LightRays from './LightRays';
import { NativeBiometric } from 'capacitor-native-biometric';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { motion, AnimatePresence } from 'framer-motion';

export const LoginView: React.FC = () => {
    const { signInWithGoogle } = useAuth();
    const [isRegistering, setIsRegistering] = useState(false);
    const [isRecovering, setIsRecovering] = useState(false);
    const [confirmationSent, setConfirmationSent] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [gender, setGender] = useState<'female' | 'male' | null>(null);
    const [currency, setCurrency] = useState('CLP');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [hasStoredCredentials, setHasStoredCredentials] = useState(false);

    const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Light) => {
        try {
            await Haptics.impact({ style });
        } catch (e) {
            // Silently fail on non-mobile envs
        }
    };

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
                redirectTo: 'https://registbar.efinnovation.cl',
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
                            currency: currency, // Save selected currency
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

    const toggleRegister = () => {
        setIsRegistering(!isRegistering);
        triggerHaptic(ImpactStyle.Medium);
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
        triggerHaptic(ImpactStyle.Light);
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
        <div className="min-h-screen bg-[#050505] flex items-center justify-center relative overflow-hidden font-sans">
            {/* Background elements */}
            <div className="absolute inset-0 z-0">
                <LightRays
                    raysOrigin="center"
                    raysColor={raysColor}
                    raysSpeed={0.5}
                    lightSpread={1.2}
                    rayLength={2}
                    followMouse={true}
                    mouseInfluence={0.05}
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(10,10,10,0)_0%,#050505_100%)]"></div>
            </div>

            <div className="container max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-center p-6 lg:p-12 z-10 gap-12 lg:gap-20 min-h-screen py-12 lg:py-0 pb-safe">
                
                {/* Left Side: Value Proposition (Desktop) / Header (Mobile) */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="flex flex-col items-center lg:items-start text-center lg:text-left flex-1 max-w-xl"
                >
                    <motion.div 
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                        className="flex items-center gap-4 mb-8"
                    >
                        <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary-dark rounded-2xl flex items-center justify-center shadow-neon-strong">
                            <Icon name="savings" size={32} className="text-white" />
                        </div>
                        <span className="text-4xl font-black tracking-tighter text-white">Regist<span className="text-primary">Bar</span></span>
                    </motion.div>

                    <h1 className="text-4xl lg:text-5xl xl:text-6xl font-black text-white leading-[1.1] mb-6 tracking-tight">
                        La libertad financiera <br />
                        comienza con un <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-white to-primary-light">gran servicio</span>.
                    </h1>
                    
                    <p className="text-slate-400 text-lg mb-10 leading-relaxed font-medium max-w-md">
                        RegistBar: El aliado inteligente para los profesionales del estilo. Controla tus ingresos, gastos y metas con IA.
                    </p>

                    <div className="hidden lg:grid grid-cols-2 gap-6 w-full">
                        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all hover:translate-y-[-4px]">
                            <Icon name="monitoring" className="text-primary mb-3" size={24} />
                            <h3 className="text-white font-bold mb-1">Métricas Reales</h3>
                            <p className="text-slate-500 text-sm">Visualiza tu crecimiento diario y mensual sin complicaciones.</p>
                        </div>
                        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all hover:translate-y-[-4px]">
                            <Icon name="auto_awesome" className="text-primary mb-3" size={24} />
                            <h3 className="text-white font-bold mb-1">IA Financiera</h3>
                            <p className="text-slate-500 text-sm">Recibe consejos personalizados para optimizar tu rentabilidad.</p>
                        </div>
                    </div>
                </motion.div>

                {/* Right Side: Auth Form */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="w-full max-w-md lg:w-[450px]"
                >
                    <div className="bg-[#0f0f0f]/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 lg:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
                        {/* Shimmer effect on card */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                        
                        <div className="relative z-20">
                            <div className="mb-8">
                                <h2 className="text-2xl font-bold text-white mb-2">
                                    {isRegistering ? 'Crea tu Cuenta' : 'Iniciar Sesión'}
                                </h2>
                                <p className="text-slate-500 text-sm">
                                    {isRegistering 
                                        ? 'Únete a la élite del sector belleza.' 
                                        : 'Gestiona tu éxito financiero hoy.'}
                                </p>
                            </div>

                            <form 
                                onSubmit={(e) => {
                                    handleAuth(e);
                                    triggerHaptic(ImpactStyle.Medium);
                                }} 
                                className="flex flex-col gap-4"
                            >
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
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white/10 transition-all font-medium"
                                            />
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleGenderSelect('female');
                                                    triggerHaptic(ImpactStyle.Light);
                                                }}
                                                className={`flex-1 py-3 rounded-2xl border flex items-center justify-center gap-2 transition-all ${gender === 'female' ? 'bg-pink-500 border-pink-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.4)] scale-[1.02]' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                                            >
                                                <Icon name="female" size={18} />
                                                <span className="text-xs font-bold uppercase tracking-wider">Mujer</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    handleGenderSelect('male');
                                                    triggerHaptic(ImpactStyle.Light);
                                                }}
                                                className={`flex-1 py-3 rounded-2xl border flex items-center justify-center gap-2 transition-all ${gender === 'male' ? 'bg-cyan-600 border-cyan-600 text-white shadow-[0_0_20px_rgba(8,145,178,0.4)] scale-[1.02]' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                                            >
                                                <Icon name="male" size={18} />
                                                <span className="text-xs font-bold uppercase tracking-wider">Hombre</span>
                                            </button>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-widest">Moneda Principal</label>
                                            <div className="relative group">
                                                <Icon name="payments" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors pointer-events-none" />
                                                <select
                                                    value={currency}
                                                    onChange={(e) => setCurrency(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-10 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white/10 transition-all font-medium appearance-none cursor-pointer"
                                                >
                                                    {[
                                                        {
                                                            group: 'Norteamérica', options: [
                                                                { code: 'MXN', label: 'Peso Mexicano', flag: '🇲🇽' },
                                                                { code: 'USD', label: 'Dólar (EEUU)', flag: '🇺🇸' },
                                                            ]
                                                        },
                                                        {
                                                            group: 'Sudamérica', options: [
                                                                { code: 'CLP', label: 'Peso Chileno', flag: '🇨🇱' },
                                                                { code: 'ARS', label: 'Peso Argentino', flag: '🇦🇷' },
                                                                { code: 'BOB', label: 'Boliviano', flag: '🇧🇴' },
                                                                { code: 'COP', label: 'Peso Colombiano', flag: '🇨🇴' },
                                                                { code: 'PEN', label: 'Sol Peruano', flag: '🇵🇪' },
                                                                { code: 'PYG', label: 'Guaraní (Paraguay)', flag: '🇵🇾' },
                                                                { code: 'UYU', label: 'Peso Uruguayo', flag: '🇺🇾' },
                                                                { code: 'VES', label: 'Bolívar (Venezuela)', flag: '🇻🇪' },
                                                            ]
                                                        },
                                                        {
                                                            group: 'Centroamérica y Caribe', options: [
                                                                { code: 'CRC', label: 'Colón (Costa Rica)', flag: '🇨🇷' },
                                                                { code: 'DOP', label: 'Peso Dominicano', flag: '🇩🇴' },
                                                                { code: 'GTQ', label: 'Quetzal (Guatemala)', flag: '🇬🇹' },
                                                                { code: 'HNL', label: 'Lempira (Honduras)', flag: '🇭🇳' },
                                                                { code: 'NIO', label: 'Córdoba (Nicaragua)', flag: '🇳🇮' },
                                                            ]
                                                        },
                                                        {
                                                            group: 'Europa', options: [
                                                                { code: 'EUR', label: 'Euro', flag: '🇪🇺' },
                                                            ]
                                                        }
                                                    ].map((g) => (
                                                        <optgroup key={g.group} label={g.group} className="text-slate-900 font-bold bg-white">
                                                            {g.options.map((c) => (
                                                                <option key={c.code} value={c.code} className="text-slate-900 font-medium">
                                                                    {c.flag} {c.label} ({c.code})
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    ))}
                                                </select>
                                                <Icon name="expand_more" size={20} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="group relative">
                                    <Icon name="mail" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="email"
                                        placeholder="Correo Electrónico"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white/10 transition-all font-medium"
                                    />
                                </div>

                                <div className="group relative">
                                    <Icon name="lock" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Contraseña"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white/10 transition-all font-medium"
                                    />
                                    <button
                                        type="button"
                                        onClick={togglePasswordVisibility}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                    >
                                        <Icon name={showPassword ? "visibility_off" : "visibility"} size={20} />
                                    </button>
                                </div>

                                {!isRegistering && (
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsRecovering(true);
                                                triggerHaptic(ImpactStyle.Medium);
                                            }}
                                            className="text-xs text-slate-500 hover:text-primary transition-colors font-bold"
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
                                    className="mt-2 w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-neon transition-all flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 animate-gradient-shift"
                                >
                                    {loading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" /> : isRegistering ? 'Comenzar Ahora' : 'Acceder'}
                                    <Icon name="arrow_forward" size={20} />
                                </button>

                                {!isRegistering && biometricAvailable && hasStoredCredentials && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleBiometricLogin();
                                            triggerHaptic(ImpactStyle.Heavy);
                                        }}
                                        className="w-full bg-white/5 border border-white/10 text-white font-bold py-4 rounded-2xl hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center gap-3"
                                    >
                                        <Icon name="fingerprint" size={24} className="text-primary" />
                                        Entrar con Huella
                                    </button>
                                )}
                            </form>

                            <div className="my-6 flex items-center w-full gap-4">
                                <div className="h-px bg-white/5 flex-1" />
                                <span className="text-[10px] text-slate-700 uppercase tracking-widest font-black">O continúa con</span>
                                <div className="h-px bg-white/5 flex-1" />
                            </div>

                            <button
                                onClick={() => {
                                    signInWithGoogle();
                                    triggerHaptic(ImpactStyle.Medium);
                                }}
                                className="w-full bg-white text-slate-900 font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                                Google
                            </button>
                        </div>
                    </div>

                    <p className="mt-8 text-center text-sm text-slate-500 font-medium pb-8 lg:pb-0">
                        {isRegistering ? '¿Ya tienes una cuenta?' : '¿Nuevo en RegistBar?'}
                        <button
                            onClick={toggleRegister}
                            className="ml-2 text-primary font-bold hover:underline"
                        >
                            {isRegistering ? 'Inicia Sesión' : 'Regístrate aquí'}
                        </button>
                    </p>
                </motion.div>
            </div>

            {/* Bottom Sheet for Recovery (Mobile Drawer) */}
            <AnimatePresence>
                {isRecovering && (
                    <>
                        {/* Backdrop */}
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsRecovering(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
                        />
                        {/* Drawer */}
                        <motion.div 
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="fixed bottom-0 left-0 right-0 bg-[#0f0f0f] border-t border-white/10 rounded-t-[2.5rem] z-[101] p-8 pb-safe shadow-[0_-20px_50px_rgba(0,0,0,0.5)] lg:max-w-md lg:mx-auto lg:rounded-[2.5rem] lg:bottom-12 lg:border"
                        >
                            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8 hidden lg:block"></div>
                            
                            <div className="mb-8">
                                <h2 className="text-2xl font-bold text-white mb-2">Recuperar Acceso</h2>
                                <p className="text-slate-500 text-sm text-center">Te enviaremos un enlace de recuperación.</p>
                            </div>

                            <form 
                                onSubmit={(e) => {
                                    handlePasswordReset(e);
                                    triggerHaptic(ImpactStyle.Heavy);
                                }} 
                                className="flex flex-col gap-4"
                            >
                                <div className="group relative">
                                    <Icon name="mail" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="email"
                                        placeholder="Correo Electrónico"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white/10 transition-all font-medium"
                                    />
                                </div>

                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl text-center">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="mt-2 w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-neon transition-all flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                                >
                                    {loading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" /> : 'Enviar Enlace'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsRecovering(false);
                                        triggerHaptic(ImpactStyle.Light);
                                    }}
                                    className="mt-2 text-sm text-slate-500 hover:text-white transition-colors py-2"
                                >
                                    Cancelar
                                </button>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
