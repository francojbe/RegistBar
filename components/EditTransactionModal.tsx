import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { motion } from 'framer-motion';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { useCurrency } from '../utils/currency';
import { OfflineService } from '../OfflineService';
import { Transaction } from '../types';

interface EditTransactionModalProps {
    transaction: Transaction;
    onClose: () => void;
    onDeleted?: () => void;
    onUpdated?: () => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({ transaction, onClose, onDeleted, onUpdated }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const { format, symbol } = useCurrency();
    const [loading, setLoading] = useState(false);
    
    // Form state
    const [title, setTitle] = useState(transaction.title);
    const [category, setCategory] = useState(transaction.category);
    const [date, setDate] = useState(() => {
        const d = new Date(transaction.rawDate);
        return d.toISOString().slice(0, 16);
    });
    
    // For services, we track the gross/commission
    const [grossAmount, setGrossAmount] = useState<string>(String(transaction.gross_amount || 0));
    const [liquidAmount, setLiquidAmount] = useState<string>(String(transaction.amount || 0));
    
    const [commissionRate, setCommissionRate] = useState<number>(0);
    const [expenseModel, setExpenseModel] = useState<'commission' | 'rent'>('commission');

    useEffect(() => {
        if (!user) return;
        const fetchSettings = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('commission_rate, expense_model')
                .eq('id', user.id)
                .single();

            if (data && !error) {
                setExpenseModel(data.expense_model || 'commission');
                setCommissionRate(data.commission_rate ?? 40);
            }
        };
        fetchSettings();
    }, [user]);

    // Recalculate if it's a service
    const isService = category === 'service';
    
    const currentGross = isService ? Number(grossAmount) : Number(liquidAmount);
    const commAmt = isService && expenseModel === 'commission' ? Math.round(currentGross * (commissionRate / 100)) : 0;
    const finalLiquid = isService ? currentGross - commAmt : currentGross;
    const retention = Math.round(finalLiquid * 0.1375);

    const handleUpdate = async () => {
        if (!user) return;
        setLoading(true);

        const payload = {
            title: title,
            amount: finalLiquid,
            type: transaction.type, // Keep original income/expense type
            category: category,
            date: new Date(date).toISOString(),
            gross_amount: isService ? currentGross : null,
            commission_amount: isService ? commAmt : null,
            retention_amount: isService ? retention : null
        };

        const { error, offline } = await OfflineService.updateTransaction(user.id, transaction.id, payload);

        setLoading(false);

        if (error) {
            showToast('Error al actualizar registro', 'error');
        } else {
            showToast(offline ? 'Cambios guardados localmente' : '¡Registro actualizado!', 'success');
            if (onUpdated) onUpdated();
            else window.location.reload();
            onClose();
        }
    };

    const handleDelete = async () => {
        if (!user) return;
        if (!window.confirm('¿Estás seguro de eliminar este registro?')) return;
        
        setLoading(true);
        const { error } = await OfflineService.deleteTransaction(user.id, transaction.id);
        setLoading(false);

        if (error) {
            showToast('Error al eliminar registro', 'error');
        } else {
            showToast('Registro eliminado', 'success');
            if (onDeleted) onDeleted();
            else window.location.reload();
            onClose();
        }
    };

    return (
        <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[60] bg-slate-50 flex flex-col"
        >
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-4 bg-white border-b border-slate-100">
                <button onClick={onClose} className="p-2 -ml-2 text-slate-400 hover:text-slate-700 transition-colors">
                    <Icon name="close" size={24} />
                </button>
                <h2 className="text-lg font-bold text-slate-900">Ver Registro</h2>
                <button onClick={handleDelete} className="p-2 text-red-400 hover:text-red-600 transition-colors">
                    <Icon name="delete" size={24} />
                </button>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 no-scrollbar pb-32">
                
                {/* Title */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Descripción</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                </div>

                {/* Amount Handling */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                        {isService ? 'Monto Total (Precio Cobrado)' : 'Monto Recibido'}
                    </label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{symbol}</span>
                        <input
                            type="number"
                            value={isService ? grossAmount : liquidAmount}
                            onChange={(e) => isService ? setGrossAmount(e.target.value) : setLiquidAmount(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-3 text-slate-900 font-bold focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all"
                        />
                    </div>
                </div>

                {/* Date */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Fecha y Hora</label>
                    <input
                        type="datetime-local"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all [color-scheme:light]"
                    />
                </div>

                {/* Summary for Services */}
                {isService && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">RECÁLCULO DE GANANCIA</p>
                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Total Cobrado</span>
                                <span className="font-bold text-slate-900">{format(currentGross)}</span>
                            </div>
                            {expenseModel === 'commission' && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-medium">Comisión Salon</span>
                                    <span className="font-bold text-red-500">-{format(commAmt)}</span>
                                </div>
                            )}
                            <div className="pt-3 border-t border-dashed border-slate-100 flex justify-between items-center">
                                <span className="font-bold text-slate-900">Tu Ganancia Líquida</span>
                                <span className="text-2xl font-extrabold text-primary">{format(finalLiquid)}</span>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* Footer */}
            <div className="fixed bottom-0 left-0 w-full p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-[70]">
                <button
                    onClick={handleUpdate}
                    disabled={loading}
                    className="w-full bg-slate-900 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                    {loading ? <span>Guardando...</span> : <span>Guardar Cambios</span>}
                </button>
            </div>

        </motion.div>
    );
};
