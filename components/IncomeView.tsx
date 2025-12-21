import React, { useState } from 'react';
import { Icon } from './Icons';
import { Transaction } from '../types';
import { NewServiceModal } from './NewServiceModal';
import { ScanReceiptView } from './ScanReceiptView';
import { TipModal } from './TipModal';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';

import { useToast } from '../contexts/ToastContext';

interface IncomeViewProps {
    onGoToReports: () => void;
}

export const IncomeView: React.FC<IncomeViewProps> = ({ onGoToReports }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [showNewService, setShowNewService] = useState(false);
    const [showScanReceipt, setShowScanReceipt] = useState(false);
    const [showTipModal, setShowTipModal] = useState(false);

    // Data State (Lazy Init from Cache)
    const [allTransactions, setAllTransactions] = useState<Transaction[]>(() => {
        const saved = localStorage.getItem('dashboard_cache');
        return saved ? JSON.parse(saved).transactions : [];
    });
    const [dailyTotal, setDailyTotal] = useState(() => {
        const saved = localStorage.getItem('dashboard_cache');
        return saved ? JSON.parse(saved).dailyTotal : 0;
    });
    const [serviceCount, setServiceCount] = useState(() => {
        const saved = localStorage.getItem('dashboard_cache');
        return saved ? JSON.parse(saved).serviceCount : 0;
    });

    const [visibleCount, setVisibleCount] = useState(5);

    // Get current date helper in Chile Time
    const today = new Date();
    const dateOptions: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        timeZone: 'America/Santiago'
    };
    const formattedDate = today.toLocaleDateString('es-CL', dateOptions);
    const displayDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    // Get user name helper (simplified to use cache or auth)
    const userName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Usuario';

    // Edit State
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [lastDeletedTx, setLastDeletedTx] = useState<Transaction | null>(null);
    const [deleteTimer, setDeleteTimer] = useState<NodeJS.Timeout | null>(null);
    const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

    const fetchDailyData = async () => {
        if (!user) return;

        // Background Fetch
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false });

        if (data) {
            const allFormatted = data.map((t: any) => ({
                id: t.id,
                title: t.title,
                date: new Date(t.date).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' }),
                time: new Date(t.date).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit' }),
                amount: t.amount,
                type: t.type,
                category: t.category,
                icon: t.category === 'service' ? 'content_cut' : t.category === 'tip' ? 'savings' : (t.title && t.title.includes('Aporte a Ahorro')) ? 'savings' : 'shopping_bag',
                rawDate: t.date // Store ISO date for editing
            }));

            // Filter today's data using Chile timezone specifically
            const todayChileStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
            const todayTx = data.filter((t: any) =>
                new Date(t.date).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' }) === todayChileStr
            );

            const balance = todayTx.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
            const services = todayTx.filter((t: any) => t.category === 'service').length;

            // Only update if changed (Simple JSON stringify comparison can be expensive but for small datasets ok, 
            // or just rely on React diffing. We will just update and trust React)

            setAllTransactions(allFormatted);
            setDailyTotal(balance);
            setServiceCount(services);

            // Update Cache
            localStorage.setItem('dashboard_cache', JSON.stringify({
                transactions: allFormatted,
                dailyTotal: balance,
                serviceCount: services,
                timestamp: new Date().getTime()
            }));
        }
    };

    // Fetch Data on mount
    React.useEffect(() => {
        fetchDailyData();
    }, [user]);

    const handleDelete = async (tx: Transaction) => {
        // Optimistic UI update
        setAllTransactions(prev => prev.filter(t => t.id !== tx.id));

        try {
            // 1. Check if it's a Savings transaction to update the Goal
            if (tx.title && tx.title.includes('Aporte a Ahorro')) {
                const amountToDeduct = Math.abs(Number(tx.amount));

                // Fetch current goal
                const { data: goalData } = await supabase
                    .from('goals')
                    .select('id, current_amount')
                    .eq('user_id', user.id)
                    .single();

                if (goalData) {
                    const newAmount = Math.max(0, (goalData.current_amount || 0) - amountToDeduct);
                    await supabase
                        .from('goals')
                        .update({ current_amount: newAmount })
                        .eq('id', goalData.id);
                }
            }

            // 2. Delete the transaction
            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', tx.id);

            if (error) throw error;
            showToast("Registro eliminado con éxito", "success");
            fetchDailyData(); // Refresh to be safe
        } catch (error) {
            console.error("Error deleting transaction:", error);
            showToast("Error al eliminar registro", "error");
            fetchDailyData(); // Revert on error
        }
        setTxToDelete(null);
    };

    const handleRestore = () => {
        if (lastDeletedTx) {
            if (deleteTimer) clearTimeout(deleteTimer);
            setAllTransactions(prev => [lastDeletedTx, ...prev].sort((a, b) => {
                // Approximate sort back
                return 0; // The component handles sorting by date, but since we are just restoring...
            }));
            // Just refresh to be safe and get correct order
            fetchDailyData();
            setLastDeletedTx(null);
            setDeleteTimer(null);
            showToast("Registro restaurado", "success");
        }
    };

    const handleEdit = (tx: Transaction) => {
        setEditingTx(tx);
    };

    const handleUpdate = async (updatedTx: any) => {
        try {
            // 1. Determine CORRECT amount sign and value
            // If it was originally an expense or savings (negative), keep it negative.
            // But if user fetches the raw positive value from input, we must negate it again.
            let finalAmount = Number(updatedTx.amount);

            // Heuristic: If it's a Savings or regular Expense (shopping_bag), it should be negative
            if (updatedTx.category === 'expense' || updatedTx.category === 'savings' || updatedTx.category === 'supply' || updatedTx.category === 'other' || updatedTx.icon === 'shopping_bag' || (updatedTx.title && updatedTx.title.includes('Aporte a Ahorro'))) {
                finalAmount = -Math.abs(finalAmount);
            } else {
                finalAmount = Math.abs(finalAmount); // Income is positive
            }

            // 2. savings Goal Synchronization Logic
            if (updatedTx.title && updatedTx.title.includes('Aporte a Ahorro')) {
                // We need to know the OLD amount to calculate the difference.
                // We can either fetch it or rely on `allTransactions` state finding the old one before update.
                const originalTx = allTransactions.find(t => t.id === updatedTx.id);
                if (originalTx) {
                    const oldAbsAmount = Math.abs(Number(originalTx.amount));
                    const newAbsAmount = Math.abs(finalAmount);
                    const difference = newAbsAmount - oldAbsAmount; // e.g. Changed 5000 to 7000 => +2000 diff

                    if (difference !== 0) {
                        const { data: goalData } = await supabase.from('goals').select('id, current_amount').eq('user_id', user?.id).single();
                        if (goalData) {
                            await supabase.from('goals').update({
                                current_amount: (goalData.current_amount || 0) + difference
                            }).eq('id', goalData.id);
                        }
                    }
                }
            }

            const { error } = await supabase
                .from('transactions')
                .update({
                    title: updatedTx.title,
                    amount: finalAmount, // Use the corrected signed amount
                    date: updatedTx.rawDate
                })
                .eq('id', updatedTx.id);

            if (error) throw error;
            showToast("Registro actualizado", "success");
            setEditingTx(null);
            fetchDailyData();
        } catch (error) {
            console.error("Error updating transaction:", error);
            showToast("Error al actualizar", "error");
        }
    };

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 10);
    };

    return (
        <>
            <div className="flex flex-col gap-6 animate-fade-in-up">
                {/* Header section specific to Income View */}
                <header className="flex items-center justify-between py-2">
                    <button className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors">
                        <Icon name="menu" size={28} />
                    </button>
                    <h1 className="text-lg font-bold text-slate-900">Registros</h1>
                    <div
                        className="size-9 rounded-full bg-cover bg-center ring-2 ring-white shadow-sm"
                        style={{ backgroundImage: `url("${user?.user_metadata?.avatar_url || 'https://ui-avatars.com/api/?name=' + userName + '&background=random'}")` }}
                    ></div>
                </header>

                {/* Greeting */}
                <div>
                    <p className="text-sm font-medium text-slate-500 mb-0.5">{displayDate}</p>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Hola, {userName}</h2>
                </div>

                {/* Summary Card */}
                <div className="bg-white rounded-[2.5rem] p-6 relative overflow-hidden shadow-soft group hover:scale-[1.01] transition-transform duration-300">
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-1">
                            <p className="text-slate-400 font-medium">Balance de hoy</p>
                            <div className="flex items-center gap-1 bg-green-100 px-2 py-1 rounded-lg">
                                <Icon name="trending_up" size={16} className="text-green-600" />
                                <span className="text-xs font-bold text-green-600">Día</span>
                            </div>
                        </div>

                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-5xl font-bold text-slate-900 tracking-tight">$ {dailyTotal.toLocaleString('es-CL')}</span>
                            <span className="text-lg font-medium text-slate-400">CLP</span>
                        </div>

                        <p className="text-sm text-slate-500 font-medium">{serviceCount} servicios realizados hoy</p>
                    </div>
                </div>

                {/* Quick Actions */}
                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Acciones Rápidas</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Main Action - Registrar Servicio */}
                        <button
                            onClick={() => setShowNewService(true)}
                            className="col-span-2 bg-primary hover:bg-primary-dark transition-colors rounded-[2rem] p-5 flex items-center justify-between group active:scale-[0.98] shadow-lg shadow-primary/30"
                        >
                            <div className="flex items-center gap-4">
                                <div className="size-12 rounded-full bg-white/20 flex items-center justify-center">
                                    <Icon name="content_cut" size={24} className="text-white" />
                                </div>
                                <div className="flex flex-col items-start text-left">
                                    <span className="text-lg font-bold text-white leading-tight">Registrar Servicio</span>
                                    <span className="text-xs font-medium text-white/80">Incluir comisión y extras</span>
                                </div>
                            </div>
                            <div className="size-10 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                <Icon name="arrow_forward" size={20} className="text-white" />
                            </div>
                        </button>

                        {/* Secondary Action - Propina */}
                        <button
                            onClick={() => setShowTipModal(true)}
                            className="bg-white hover:bg-slate-50 transition-colors rounded-[2rem] p-5 flex flex-col items-center justify-center gap-3 text-center group active:scale-[0.98] shadow-soft"
                        >
                            <div className="size-12 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Icon name="savings" size={24} filled />
                            </div>
                            <span className="text-sm font-bold text-slate-900 leading-tight">Propina<br />Rápida</span>
                        </button>

                        {/* Secondary Action - Comprobante */}
                        <button
                            onClick={() => setShowScanReceipt(true)}
                            className="bg-white hover:bg-slate-50 transition-colors rounded-[2rem] p-5 flex flex-col items-center justify-center gap-3 text-center group active:scale-[0.98] shadow-soft"
                        >
                            <div className="size-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Icon name="receipt_long" size={24} />
                            </div>
                            <span className="text-sm font-bold text-slate-900 leading-tight">Cargar<br />Comprobante</span>
                        </button>


                    </div>
                </div>

                {/* Recent Records */}
                <div className="pb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-900">Últimos Registros</h3>
                        <button
                            onClick={onGoToReports}
                            className="text-sm font-bold text-primary hover:underline hover:text-primary-dark"
                        >
                            Ver Historial completo
                        </button>
                    </div>

                    <div className="flex flex-col gap-3">
                        {allTransactions.slice(0, visibleCount).map((tx) => (
                            <div key={tx.id} className="relative overflow-hidden rounded-[1.5rem] group">
                                {/* Background Swipe Layer */}
                                <div className="absolute inset-0 flex overflow-hidden rounded-[1.5rem]">
                                    {/* Edit Side (Blue) */}
                                    <div className="flex-1 bg-blue-600 flex items-center justify-start pl-8">
                                        <div className="flex flex-col items-center gap-1 text-white opacity-90">
                                            <Icon name="edit" size={24} />
                                            <span className="text-[10px] font-bold uppercase tracking-tighter">Editar</span>
                                        </div>
                                    </div>
                                    {/* Delete Side (Red) */}
                                    <div className="flex-1 bg-red-500 flex items-center justify-end pr-8">
                                        <div className="flex flex-col items-center gap-1 text-white opacity-90">
                                            <Icon name="delete" size={24} />
                                            <span className="text-[10px] font-bold uppercase tracking-tighter">Eliminar</span>
                                        </div>
                                    </div>
                                </div>

                                <motion.div
                                    layout
                                    drag="x"
                                    dragConstraints={{ left: 0, right: 0 }}
                                    dragElastic={0.8}
                                    dragTransition={{ bounceStiffness: 400, bounceDamping: 20 }}
                                    whileDrag={{ scale: 0.98, boxShadow: "0 10px 30px -10px rgb(0 0 0 / 0.1)" }}
                                    onDragEnd={(_, info) => {
                                        if (info.offset.x > 140 || info.velocity.x > 700) {
                                            handleEdit(tx);
                                        } else if (info.offset.x < -140 || info.velocity.x < -700) {
                                            setTxToDelete(tx); // Trigger confirmation modal
                                        }
                                    }}
                                    className="flex items-center justify-between p-4 bg-white relative z-10 touch-pan-y cursor-grab active:cursor-grabbing border border-slate-100 shadow-soft"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`size-12 rounded-full flex items-center justify-center ${tx.icon === 'shopping_bag' ? 'bg-orange-100 text-orange-600' :
                                            tx.icon === 'savings' ? 'bg-green-100 text-green-600' :
                                                'bg-purple-100 text-purple-600'
                                            } transition-transform`}>
                                            <Icon name={tx.icon} size={22} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-900">{tx.title}</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs text-slate-400">{tx.date}</span>
                                                <span className="text-[10px] text-slate-400">•</span>
                                                <span className="text-xs text-slate-400">{tx.time}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`text-sm font-bold font-mono ${tx.icon === 'shopping_bag' ? 'text-red-500' : 'text-slate-900'}`}>
                                        {tx.icon === 'shopping_bag' ? '-' : '+'}${tx.amount.toLocaleString('es-CL')}
                                    </span>
                                </motion.div>
                            </div>
                        ))}
                    </div>

                    {visibleCount < allTransactions.length && (
                        <button
                            onClick={handleLoadMore}
                            className="w-full mt-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-slate-500 font-bold text-sm hover:bg-white hover:text-primary transition-all active:scale-95"
                        >
                            Ver más movimientos...
                        </button>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {showNewService && <NewServiceModal onClose={() => setShowNewService(false)} />}
                {showScanReceipt && <ScanReceiptView onClose={() => setShowScanReceipt(false)} />}
                {showTipModal && <TipModal onClose={() => setShowTipModal(false)} />}
                {editingTx && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4">
                                <button
                                    onClick={() => setEditingTx(null)}
                                    className="size-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 transition-colors"
                                >
                                    <Icon name="close" size={20} />
                                </button>
                            </div>

                            <div className="flex items-center gap-4 mb-8">
                                <div className="size-14 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                                    <Icon name="edit" size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Editar Registro</h2>
                                    <p className="text-sm font-medium text-slate-400">Modifica los detalles del registro</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block ml-1">Descripción</label>
                                    <input
                                        type="text"
                                        value={editingTx.title}
                                        onChange={(e) => setEditingTx({ ...editingTx, title: e.target.value })}
                                        className="w-full bg-slate-50 border-2 border-transparent rounded-[1.2rem] p-4 text-slate-900 font-bold focus:border-indigo-500 focus:bg-white outline-none transition-all shadow-inner"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block ml-1">Monto ($)</label>
                                    <input
                                        type="number"
                                        value={Math.abs(editingTx.amount).toString().replace(/^0+/, '')}
                                        onChange={(e) => setEditingTx({ ...editingTx, amount: Number(e.target.value) })}
                                        className="w-full bg-slate-50 border-2 border-transparent rounded-[1.2rem] p-4 text-slate-900 font-bold focus:border-blue-500 focus:bg-white outline-none transition-all shadow-inner"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block ml-1">Fecha</label>
                                    <input
                                        type="date"
                                        value={editingTx.rawDate ? new Date(editingTx.rawDate).toISOString().split('T')[0] : ''}
                                        onChange={(e) => {
                                            // Maintain the time if possible, or just set to noon UTC for stability
                                            const newDateStr = e.target.value;
                                            if (newDateStr) {
                                                const originalDate = new Date(editingTx.rawDate || new Date());
                                                const [year, month, day] = newDateStr.split('-').map(Number);
                                                const updatedDate = new Date(originalDate);
                                                updatedDate.setFullYear(year, month - 1, day);
                                                setEditingTx({ ...editingTx, rawDate: updatedDate.toISOString() });
                                            }
                                        }}
                                        className="w-full bg-slate-50 border-2 border-transparent rounded-[1.2rem] p-4 text-slate-900 font-bold focus:border-blue-500 focus:bg-white outline-none transition-all shadow-inner"
                                    />
                                </div>


                                <button
                                    onClick={() => handleUpdate(editingTx)}
                                    className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-bold text-lg hover:bg-black transition-all active:scale-95 shadow-lg shadow-slate-900/20"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {txToDelete && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white w-full max-w-xs rounded-[2rem] p-8 shadow-2xl flex flex-col items-center text-center"
                        >
                            <div className="size-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4">
                                <Icon name="delete_forever" size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">¿Eliminar registro?</h3>
                            <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                                Esta acción no se puede deshacer. Se eliminará el registro de
                                <span className="font-bold text-slate-700"> {txToDelete.title}</span>.
                            </p>

                            <div className="flex flex-col w-full gap-3">
                                <button
                                    onClick={() => handleDelete(txToDelete)}
                                    className="w-full bg-red-500 text-white py-4 rounded-2xl font-bold hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-red-500/20"
                                >
                                    Sí, Eliminar
                                </button>
                                <button
                                    onClick={() => setTxToDelete(null)}
                                    className="w-full bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
};
