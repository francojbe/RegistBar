import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './Icons';
import { motion } from 'framer-motion';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';

interface TipModalProps {
    onClose: () => void;
}

export const TipModal: React.FC<TipModalProps> = ({ onClose }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [amountStr, setAmountStr] = useState<string>('0');
    const [isAmountHidden, setIsAmountHidden] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const [showConfig, setShowConfig] = useState(false);
    const [quickValues, setQuickValues] = useState<number[]>([1000, 2000, 5000]);
    const [date, setDate] = useState('Hoy');

    // Config State
    const [tempValues, setTempValues] = useState<string[]>(['1000', '2000', '5000']);

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

    // Focus input automatically on mount
    useEffect(() => {
        if (inputRef.current && !showConfig) {
            inputRef.current.focus();
        }
    }, [showConfig]);

    const handleQuickAdd = (addAmount: number) => {
        const current = parseInt(amountStr || '0', 10);
        setAmountStr((current + addAmount).toString());
        inputRef.current?.focus();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Allow numbers only
        const val = e.target.value.replace(/[^0-9]/g, '');
        setAmountStr(val);
    };

    const formatAmount = (str: string) => {
        if (!str) return '0';
        const num = parseInt(str, 10);
        return isNaN(num) ? '0' : num.toLocaleString('es-CL');
    };

    const handleSave = async () => {
        if (!user) return;
        setLoading(true);

        const amount = parseInt(amountStr || '0', 10);

        const { error } = await supabase.from('transactions').insert({
            user_id: user.id,
            title: 'Propina',
            amount: amount,
            type: 'income',
            category: 'tip',
            date: new Date(selectedDate).toISOString()
        });

        setLoading(false);

        if (error) {
            console.error('Error saving tip:', error);
            showToast('Error al guardar propina', 'error');
        } else {
            showToast('¡Propina registrada correctamente!', 'success');
            onClose();
            window.location.reload();
        }
    };

    const handleSaveConfig = () => {
        const newValues = tempValues.map(v => parseInt(v, 10) || 0);
        setQuickValues(newValues);
        setShowConfig(false);
    };

    if (showConfig) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-[60] bg-slate-50 flex flex-col"
            >
                <header className="flex items-center justify-between px-6 py-6 bg-white border-b border-slate-100">
                    <button onClick={() => setShowConfig(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                        <Icon name="arrow_back" size={24} />
                    </button>
                    <h2 className="text-lg font-bold text-slate-900">Configurar Botones</h2>
                    <div className="w-6"></div>
                </header>

                <div className="p-6 flex flex-col gap-6">
                    <p className="text-sm text-slate-500">Define los valores para los botones de suma rápida.</p>

                    {tempValues.map((val, idx) => (
                        <div key={idx} className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Botón {idx + 1}</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                <input
                                    type="number"
                                    value={val}
                                    onChange={(e) => {
                                        const newArr = [...tempValues];
                                        newArr[idx] = e.target.value;
                                        setTempValues(newArr);
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-4 py-3 text-slate-900 font-bold focus:outline-none focus:border-primary/50"
                                />
                            </div>
                        </div>
                    ))}

                    <button
                        onClick={handleSaveConfig}
                        className="mt-4 w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:scale-[1.02] transition-transform"
                    >
                        Guardar Cambios
                    </button>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 300, mass: 0.8 }}
            className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
        >
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-6 bg-slate-50">
                <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors p-2 -ml-2">
                    <Icon name="close" size={28} />
                </button>
                <h2 className="text-xl font-bold text-slate-900">Nueva Propina</h2>
                <button onClick={() => setShowConfig(true)} className="text-slate-400 hover:text-primary transition-colors p-2 -mr-2">
                    <Icon name="settings" size={28} />
                </button>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex flex-col px-6">

                {/* Amount Input Area */}
                <div className="flex flex-col items-center justify-center mt-8 mb-10">
                    <span className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-4">Monto Recibido</span>

                    <div className="relative w-full text-center">
                        {/* Visual Fake Input for formatting/hiding support */}
                        <div
                            onClick={() => inputRef.current?.focus()}
                            className="flex items-center justify-center gap-1 cursor-text"
                        >
                            <span className="text-6xl font-extrabold text-slate-900 transition-all tracking-tight">
                                $ {isAmountHidden ? '•••••' : formatAmount(amountStr)}
                            </span>
                            {!isAmountHidden && (
                                <div className="w-1 h-12 bg-primary animate-pulse ml-1 rounded-full"></div>
                            )}
                        </div>

                        {/* Actual Hidden Input for Native Keyboard */}
                        <input
                            ref={inputRef}
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={amountStr}
                            onChange={handleInputChange}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-text"
                        />
                    </div>

                    <button
                        onClick={() => setIsAmountHidden(!isAmountHidden)}
                        className="mt-6 flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-primary hover:border-primary/30 transition-all text-xs font-bold tracking-wide shadow-sm"
                    >
                        <Icon name={isAmountHidden ? "visibility" : "visibility_off"} size={16} />
                        {isAmountHidden ? "MOSTRAR MONTO" : "OCULTAR MONTO"}
                    </button>
                </div>

                {/* Quick Add Buttons */}
                <div className="flex flex-col gap-2 mb-6 w-full max-w-xs mx-auto">
                    <span className="text-[10px] font-bold text-slate-400 uppercase text-center mb-1">Sumar al total</span>
                    <div className="flex justify-center gap-3">
                        {quickValues.map((val) => (
                            <button
                                key={val}
                                onClick={() => handleQuickAdd(val)}
                                className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold text-sm hover:bg-slate-50 hover:border-primary/50 hover:text-primary active:scale-95 transition-all shadow-sm flex-1"
                            >
                                + ${val.toLocaleString('es-CL')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Date Selection (New) */}
                <div className="bg-white rounded-2xl p-4 flex items-center justify-between border border-slate-200 mb-6 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                            <Icon name="event" size={20} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-500 uppercase">Fecha de Registro</span>
                            <input
                                type="datetime-local"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="text-sm font-bold text-slate-900 bg-transparent outline-none w-40"
                            />
                        </div>
                    </div>
                </div>

                {/* Info Banner */}
                <div className="bg-blue-50 rounded-2xl p-4 flex items-start gap-3 border border-blue-100 mb-auto">
                    <Icon name="info" size={20} className="text-blue-500 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">Control Personal</span>
                        <span className="text-xs text-slate-500 leading-relaxed font-medium">
                            Este registro es solo para tu rentabilidad interna, no se declara automáticamente al SII.
                        </span>
                    </div>
                </div>

                {/* Submit Button (Pushed to bottom) */}
                <div className="mb-6 mt-4">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full bg-slate-900 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? 'Guardando...' : (
                            <>
                                Guardar Propina
                                <Icon name="check" size={24} />
                            </>
                        )}
                    </button>
                </div>

            </div>
        </motion.div>
    );
};
