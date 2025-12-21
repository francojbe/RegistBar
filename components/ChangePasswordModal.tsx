import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { motion } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';

interface ChangePasswordModalProps {
    onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose }) => {
    const { showToast } = useToast();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [userEmail, setUserEmail] = useState<string>('');

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user?.email) setUserEmail(data.user.email);
        });
    }, []);

    // Visibility States
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSave = async () => {
        if (!newPassword || !confirmPassword) {
            showToast("Por favor completa todos los campos", "error");
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast("Las nuevas contraseñas no coinciden", "error");
            return;
        }

        if (newPassword.length < 6) {
            showToast("La nueva contraseña debe tener al menos 6 caracteres", "error");
            return;
        }

        setLoading(true);

        try {
            // Update to New Password
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;


            showToast("¡Contraseña actualizada correctamente!", "success");
            onClose();

        } catch (error: any) {
            console.error("Error changing password:", error);
            // Show the actual error message to the user for now
            showToast(error.message || "Error al cambiar la contraseña", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="relative p-6 pb-2 flex flex-col gap-1 border-b border-slate-100/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="size-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-500 shadow-sm">
                                <Icon name="lock" size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">Cambiar Contraseña</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="size-8 rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-all"
                        >
                            <Icon name="close" size={20} />
                        </button>
                    </div>

                    <p className="text-slate-400 text-sm ml-14">
                        Ingresa tu nueva contraseña.
                    </p>
                    {userEmail && (
                        <div className="flex items-center gap-2 mt-2 ml-14 w-fit px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
                            <Icon name="person" size={14} className="text-primary" />
                            <span className="text-slate-600 text-xs font-mono">{userEmail}</span>
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-4">
                    <div className="space-y-4">

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nueva Contraseña</label>
                            <div className="relative">
                                <Icon name="key" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type={showNewPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-12 py-3 text-slate-900 font-bold focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                                >
                                    <Icon name={showNewPassword ? "visibility_off" : "visibility"} size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Confirmar Nueva Contraseña</label>
                            <div className="relative">
                                <Icon name="check_circle" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-12 py-3 text-slate-900 font-bold focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                                >
                                    <Icon name={showConfirmPassword ? "visibility_off" : "visibility"} size={20} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full py-4 mt-2 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {loading ? 'Actualizando...' : 'Cambiar Contraseña'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
