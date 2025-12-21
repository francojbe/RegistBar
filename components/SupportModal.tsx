import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { motion } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';

interface SupportModalProps {
    onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ onClose }) => {
    const { showToast } = useToast();
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [userEmail, setUserEmail] = useState<string>('');
    const [userId, setUserId] = useState<string>('');

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                setUserEmail(data.user.email || '');
                setUserId(data.user.id);
            }
        });
    }, []);

    const handleSubmit = async () => {
        if (!subject.trim() || !message.trim()) {
            showToast("Por favor completa todos los campos", "error");
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase
                .from('support_tickets')
                .insert([
                    {
                        user_id: userId,
                        user_email: userEmail,
                        subject: subject.trim(),
                        message: message.trim(),
                        status: 'open'
                    }
                ]);

            if (error) throw error;

            showToast("Mensaje enviado correctamente. Te contactaremos pronto.", "success");
            onClose();

        } catch (error: any) {
            console.error("Error sending support ticket:", error);
            showToast("Error al enviar el mensaje. Inténtalo de nuevo.", "error");
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
                            <div className="size-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-500 shadow-sm">
                                <Icon name="help" size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">Ayuda y Soporte</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="size-8 rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-all"
                        >
                            <Icon name="close" size={20} />
                        </button>
                    </div>

                    <p className="text-slate-400 text-sm ml-14">
                        Cuéntanos qué sucede y te ayudaremos.
                    </p>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-4">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Asunto</label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Ej: No puedo agregar gastos"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:font-normal placeholder:text-slate-400"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Mensaje</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Describe tu problema o consulta..."
                                rows={4}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:font-normal placeholder:text-slate-400 resize-none"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full py-4 mt-2 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {loading ? (
                            <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <span>Enviar Mensaje</span>
                                <Icon name="send" size={18} />
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
