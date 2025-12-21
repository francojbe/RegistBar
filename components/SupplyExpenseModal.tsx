import React, { useState } from 'react';
import { Icon } from './Icons';
import { motion } from 'framer-motion';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';

interface SupplyExpenseModalProps {
    onClose: () => void;
}

export const SupplyExpenseModal: React.FC<SupplyExpenseModalProps> = ({ onClose }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [amount, setAmount] = useState<number>(0);
    const [description, setDescription] = useState('');

    const getChileCurrentTime = () => {
        try {
            // Use Intl.DateTimeFormat to get Santiago time parts accurately (handles DST)
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/Santiago',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            const parts = formatter.formatToParts(now);
            const getValue = (type: string) => parts.find(p => p.type === type)?.value;
            return `${getValue('year')}-${getValue('month')}-${getValue('day')}T${getValue('hour')}:${getValue('minute')}`;
        } catch (e) {
            console.error("Date calc error", e);
            return new Date().toISOString().slice(0, 16);
        }
    };

    const [selectedDate, setSelectedDate] = useState<string>(() => getChileCurrentTime());

    const handleSave = async () => {
        if (!user) return;
        setLoading(true);

        const finalAmount = -Math.abs(amount); // Ensure it's negative

        const { error } = await supabase.from('transactions').insert({
            user_id: user.id,
            title: description || 'Gasto Insumo',
            amount: finalAmount,
            type: 'expense',
            category: 'supply',
            date: new Date(selectedDate).toISOString()
        });

        setLoading(false);

        if (error) {
            console.error('Error saving expense:', error);
            showToast('Error al guardar gasto', 'error');
        } else {
            showToast('¡Gasto registrado correctamente!', 'success');
            onClose();
            window.location.reload();
        }
    };

    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 300, mass: 0.8 }}
            className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
        >
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-4 bg-white border-b border-slate-100">
                <button onClick={onClose} className="p-2 -ml-2 text-slate-400 hover:text-slate-700 transition-colors">
                    <Icon name="close" size={24} />
                </button>
                <h2 className="text-lg font-bold text-slate-900">Nuevo Gasto Insumo</h2>
                <div className="w-8"></div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">

                {/* Amount Input */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Monto del Gasto</label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input
                            type="number"
                            value={amount || ''}
                            onChange={(e) => setAmount(Number(e.target.value))}
                            placeholder="0"
                            className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-3 text-slate-900 font-bold focus:outline-none focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 transition-all"
                        />
                    </div>
                </div>

                {/* Description Input */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Descripción (Opcional)</label>
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Ej: Tinturas, Shampoo..."
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold focus:outline-none focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 transition-all"
                    />
                </div>

                {/* Date Selection */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Fecha</label>
                    <input
                        type="datetime-local"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold focus:outline-none focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 transition-all [color-scheme:light]"
                    />
                </div>

            </div>

            {/* Footer Actions */}
            <div className="mt-auto p-4 border-t border-slate-100 bg-white">
                <button
                    onClick={handleSave}
                    disabled={loading || !amount}
                    className="w-full bg-slate-900 text-white font-bold text-lg py-4 rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100"
                >
                    {loading ? 'Guardando...' : (
                        <>
                            Registrar Gasto
                            <Icon name="check" size={24} />
                        </>
                    )}
                </button>
            </div>

        </motion.div>
    );
};
