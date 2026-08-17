import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { motion } from 'framer-motion';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { useCurrency } from '../utils/currency';
import { OfflineService } from '../OfflineService';
import { trackEvent } from '../utils/analytics';

interface NewServiceModalProps {
    onClose: () => void;
    onRequestPush?: () => Promise<boolean>;
}

export const NewServiceModal: React.FC<NewServiceModalProps> = ({ onClose, onRequestPush }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const { format, symbol, locale } = useCurrency();
    const [loading, setLoading] = useState(false);
    const [totalPrice, setTotalPrice] = useState<string>('');
    const [commissionRate, setCommissionRate] = useState<number>(0); // Percentage
    const [expenseModel, setExpenseModel] = useState<'commission' | 'rent'>('commission');
    const [serviceName, setServiceName] = useState("");

    // Fetch User Settings on Mount
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
                // If model is rent, commission is 0. If commission, use the rate.
                if (data.expense_model === 'rent') {
                    setCommissionRate(0);
                } else {
                    // Use nullish coalescing (??) because 0 is a valid value but falsy
                    setCommissionRate(data.commission_rate ?? 40);
                }
            }
        };
        fetchSettings();
    }, [user]);

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

    // Derived values
    const price = Number(totalPrice || 0);
    const commissionAmount = Math.round(price * (commissionRate / 100));
    const liquidIncome = price - commissionAmount;
    const retention = Math.round(liquidIncome * 0.1375);

    const handleSave = async () => {
        if (!user || !totalPrice || !serviceName) {
            showToast('Por favor completa los campos', 'error');
            return;
        }
        setLoading(true);

        const payload = {
            title: serviceName,
            amount: liquidIncome,
            type: 'income',
            category: 'service',
            date: new Date(selectedDate).toISOString(),
            gross_amount: totalPrice,
            commission_amount: commissionAmount,
            retention_amount: retention
        };

        const { error, offline } = await OfflineService.saveTransaction(user.id, payload);

        setLoading(false);

        if (error) {
            console.error('Error saving service:', error);
            showToast('Error al guardar el servicio', 'error');
        } else {
            trackEvent('service_created', {
                service_name: serviceName,
                is_offline: offline || false,
                expense_model: expenseModel
            });
            showToast(offline ? 'Guardado localmente (Sin conexión)' : '¡Servicio registrado con éxito!', 'success');
            
            // Request push permissions in a moment of 'success'
            if (onRequestPush) {
                await onRequestPush();
            }

            onClose();
            // We should avoid full reload if possible, but for now we keep it simple 
            // or trigger a refresh via callback. 
            // Let's use a smaller delay if we must reload, or better, pass a refresh prop.
            setTimeout(() => {
                window.location.reload();
            }, 800);
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
                <h2 className="text-lg font-bold text-slate-900">Nuevo Servicio</h2>
                <div className="w-8"></div>
            </header>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 no-scrollbar pb-32">

                {/* Quick Preset Chips */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Atajos de 1-Tap</label>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {[
                            { title: 'Corte Degradé', price: 12000 },
                            { title: 'Corte Clásico', price: 10000 },
                            { title: 'Perfilado Barba', price: 6000 },
                            { title: 'Combo Corte + Barba', price: 16000 },
                            { title: 'Cejas / Diseño', price: 4000 }
                        ].map((preset, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                    setServiceName(preset.title);
                                    setTotalPrice(preset.price.toString());
                                }}
                                className="px-3 py-1.5 bg-white border border-slate-200/90 rounded-full text-xs font-bold text-slate-700 whitespace-nowrap hover:border-primary hover:text-primary active:scale-95 transition-all shadow-xs"
                            >
                                {preset.title} ({format(preset.price)})
                            </button>
                        ))}
                    </div>
                </div>

                {/* Service Name */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Nombre del Servicio</label>
                    <input
                        type="text"
                        value={serviceName}
                        onChange={(e) => setServiceName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-slate-300"
                        placeholder="Ej: Servicio, Corte, Manicure..."
                    />
                </div>
                {/* Date and Time Selection */}
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Fecha y Hora</label>
                    <div className="relative">
                        <input
                            type="datetime-local"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all [color-scheme:light]"
                        />
                        <Icon name="calendar_today" size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                {/* Amounts */}
                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-3">Monto</h3>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Precio Total del Servicio</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{symbol}</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={totalPrice}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || /^\d+$/.test(val)) {
                                        setTotalPrice(val);
                                    }
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-3 text-slate-900 font-bold focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all"
                                placeholder="0"
                            />
                        </div>
                    </div>
                </div>

                {/* Summary Card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mt-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">RESUMEN DE GANANCIA</p>

                    <div className="flex flex-col gap-3 mb-6 border-b border-dashed border-slate-100 pb-6">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 font-medium">Total Cliente</span>
                            <span className="font-bold text-slate-900">{format(totalPrice)}</span>
                        </div>
                        {expenseModel === 'commission' && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Comisión Salón <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold ml-1">{commissionRate}%</span></span>
                                <span className="font-bold text-red-500">- {format(commissionAmount)}</span>
                            </div>
                        )}
                        {expenseModel === 'rent' && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Costo Salón</span>
                                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold ml-1">Modelo Arriendo</span>
                            </div>
                        )}
                    </div>

                    <div className="mb-4">
                        <p className="text-sm font-bold text-slate-400 mb-1">Ingreso Líquido Estimado</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-extrabold text-primary tracking-tight">{format(liquidIncome)}</span>
                            {/* <span className="text-sm font-bold text-slate-400">CLP</span> Removed hardcoded CLP */}
                        </div>
                    </div>

                    {/* Smart Business Tip (AI Powered Advice) */}
                    <div className="bg-gradient-to-r from-violet-50 to-fuchsia-50 rounded-xl p-4 flex gap-3 items-start border border-violet-100/50 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Icon name="tips_and_updates" size={64} className="text-violet-500" />
                        </div>

                        <div className="p-2 bg-white rounded-full shadow-sm text-violet-500 shrink-0 z-10">
                            <Icon name="lightbulb" size={18} />
                        </div>

                        <div className="flex flex-col z-10">
                            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-0.5">Tip de Crecimiento</span>
                            <p className="text-xs leading-relaxed text-slate-700 font-medium">
                                {[
                                    "¿El cliente necesita algún producto para mantener este look en casa? ¡Ofrece una venta cruzada!",
                                    "Antes de cobrar, pregunta: '¿Te gustaría agregar un perfilado de cejas o masaje rápido?'",
                                    "Un cliente feliz trae a dos más. Pídele que te etiquete en su historia de Instagram.",
                                    "Asegura el regreso: '¿Dejamos agendada tu próxima cita para dentro de 3 semanas?'",
                                    "La experiencia lo es todo. Un simple '¿Deseas un vaso de agua?' puede aumentar tu propina.",
                                    "Toma una foto del resultado (con permiso) para tu portafolio. Es marketing gratis.",
                                    "Si es cliente nuevo, ofrécele una tarjeta de lealtad o descuento para su segunda visita.",
                                    "Explícale qué productos usaste. Educar al cliente aumenta tu autoridad y confianza."
                                ][Math.floor(Math.random() * 8)]}
                            </p>
                        </div>
                    </div>
                </div>

            </div>

            {/* Footer Actions */}
            <div className="fixed bottom-0 left-0 w-full p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-50">
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full bg-slate-900 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100"
                >
                    {loading ? (
                        <span>Guardando...</span>
                    ) : (
                        <>
                            <div className="p-1 rounded-full bg-white/20">
                                <Icon name="check" size={20} />
                            </div>
                            Guardar y Emitir
                        </>
                    )}
                </button>
            </div>

        </motion.div>
    );
};
