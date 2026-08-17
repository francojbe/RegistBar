import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { Transaction } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from '../utils/currency';
import { OfflineService } from '../OfflineService';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { formatInTimeZone } from 'date-fns-tz';
import { trackEvent, getBalanceBucket } from '../utils/analytics';

const SANTIAGO_TZ = 'America/Santiago';

export const ReportsView: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const { format } = useCurrency();

    // 1. Initialize from cache if available to prevent 0/loading flash
    const [transactions, setTransactions] = useState<Transaction[]>(() => {
        const saved = localStorage.getItem('reports_cache_v1');
        return saved ? JSON.parse(saved).transactions || [] : [];
    });

    const [loading, setLoading] = useState(() => {
        return !localStorage.getItem('reports_cache_v1');
    });

    // Month/Year Selection
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showShareModal, setShowShareModal] = useState(false);

    // Profile Expense Settings
    const [profileSettings, setProfileSettings] = useState<{
        expense_model: 'commission' | 'rent';
        rent_amount: number;
        rent_period: 'weekly' | 'monthly';
    } | null>(null);

    useEffect(() => {
        const fetchProfileSettings = async () => {
            if (!user) return;
            const { data } = await supabase
                .from('profiles')
                .select('expense_model, rent_amount, rent_period')
                .eq('id', user.id)
                .single();

            if (data) {
                setProfileSettings({
                    expense_model: data.expense_model === 'rent' ? 'rent' : 'commission',
                    rent_amount: Number(data.rent_amount) || 0,
                    rent_period: data.rent_period === 'weekly' ? 'weekly' : 'monthly'
                });
            }
        };
        fetchProfileSettings();
    }, [user]);

    const fetchMonthData = async () => {
        if (!user) return;

        // Only set loading if we don't have data yet
        if (transactions.length === 0) {
            setLoading(true);
        }

        try {
            // Refactored to use Fused Data (Local + Cloud)
            const fusedData = await OfflineService.getFusedTransactions(user.id);
            
            // Filter by selected month/year using Santiago stable dates
            const monthData = fusedData.filter(t => {
                const txMonthStr = formatInTimeZone(new Date(t.rawDate), SANTIAGO_TZ, 'yyyy-MM');
                const selectedMonthStr = formatInTimeZone(selectedDate, SANTIAGO_TZ, 'yyyy-MM');
                return txMonthStr === selectedMonthStr;
            });

            setTransactions(monthData);

            // SAVE TO CACHE
            localStorage.setItem('reports_cache_v1', JSON.stringify({
                transactions: monthData,
                timestamp: new Date().getTime(),
                month: selectedDate.getMonth(),
                year: selectedDate.getFullYear()
            }));

            // Track daily_close_viewed (ANA-01)
            const monthStr = formatInTimeZone(selectedDate, SANTIAGO_TZ, 'yyyy-MM');
            trackEvent('daily_close_viewed', {
                period_month: monthStr,
                transaction_count: monthData.length
            });

        } catch (error) {
            console.error('Error fetching reports:', error);
            showToast('Error al cargar la cartola', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        fetchMonthData();
    }, [selectedDate, user]);

    const changeMonth = (offset: number) => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setSelectedDate(newDate);
    };

    const monthName = selectedDate.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    // Summary calculations
    const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const balance = totalIncome - totalExpenses;

    // Export Handler
    const handleExport = async () => {
        if (!user) {
            console.error('Export failed: No user found');
            showToast('No hay sesión activa', 'error');
            return;
        }
        if (transactions.length === 0) {
            console.warn('Export failed: No transactions found for period', capitalizedMonth);
            showToast('No hay datos para exportar', 'info');
            return;
        }

        try {
            console.log('Starting export for:', user.email);
            console.log('Transactions count:', transactions.length);

            // Calculate detailed stats for PDF
            // 1. Services Total (Income from 'service' category)
            const servicesTotal = transactions
                .filter(t => t.type === 'income' && t.category === 'service')
                .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

            // 2. Tips Total
            const tipsTotal = transactions
                .filter(t => t.type === 'income' && t.category === 'tip')
                .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

            const productsTotal = transactions
                .filter(t => t.type === 'income' && t.category !== 'service' && t.category !== 'tip')
                .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

            // Calculate endOfMonth for Rent Transaction Date
            const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59).toISOString();

            // 4. Supplies Expenses (Explicitly 'supply' category)
            const suppliesTotal = transactions
                .filter(t => t.type === 'expense' && t.category === 'supply')
                .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

            // 5. Commission/Rent Expenses
            // MODIFIED: We only track explicit expenses now to match the Dashboard's "Pocket View".
            // Implicit commissions (deducted before income) are ignored in this view.

            /* Old Logic (Accounting View)
            const commissionFromServices = transactions
                .filter(t => t.type === 'income' && t.category === 'service')
                .reduce((sum, t) => sum + (Number(t.commission_amount) || 0), 0);
            */

            const commissionFromServices = 0; // Disabled to match Dashboard

            const otherExpenses = transactions
                .filter(t => t.type === 'expense' && t.category !== 'supply')
                .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

            // RENT CALCULATION
            let calculatedRent = 0;
            let rentTransaction: any = null;

            if (profileSettings?.expense_model === 'rent' && profileSettings.rent_amount > 0) {
                // Determine weeks multiplier
                const multiplier = profileSettings.rent_period === 'weekly' ? 4 : 1;
                calculatedRent = profileSettings.rent_amount * multiplier;

                // Create virtual transaction for the report list
                // We use endOfMonth as the date
                const rentDate = new Date(endOfMonth);
                rentTransaction = {
                    id: 'rent-deduction',
                    title: `Arriendo Salón (${profileSettings.rent_period === 'weekly' ? '4 semanas' : 'Mensual'})`,
                    date: rentDate.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: 'short' }),
                    time: '00:00',
                    amount: -calculatedRent, // Negative for expense
                    type: 'expense',
                    category: 'other',
                    icon: 'storefront',
                    rawDate: endOfMonth,
                    gross_amount: 0,
                    commission_amount: 0
                };
            }

            const commissionRentTotal = commissionFromServices + otherExpenses + calculatedRent;

            // Total Gross (re-calculated to match PDF logic)
            // MODIFIED: Use Liquid Amount (t.amount) to match Dashboard "Ventas Totales".
            // Was: t.gross_amount || t.amount
            const grossIncome = transactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);

            // Total Actual Expenses (Out of pocket + Deductions)
            // MODIFIED: Only explicit expenses (totalExpenses already sums all type='expense')
            const trueTotalExpenses = totalExpenses + calculatedRent;

            console.log('Stats calculated (Pocket View):', {
                servicesTotal,
                tipsTotal,
                productsTotal,
                suppliesTotal,
                commissionRentTotal,
                grossIncome,
                trueTotalExpenses,
                balance
            });

            // Determine User Name with better fallback
            // Try metadata first, then email user part, then 'Usuario'
            let userNameToUse = user.user_metadata?.full_name;
            if (!userNameToUse && user.email) {
                userNameToUse = user.email.split('@')[0];
            }
            if (!userNameToUse) {
                userNameToUse = 'Usuario';
            }

            const { generateMonthlyReportPDF } = await import('../utils/pdfGenerator');
            await generateMonthlyReportPDF({
                userName: userNameToUse,
                userEmail: user.email || '',
                period: capitalizedMonth,
                transactions: rentTransaction ? [...transactions, rentTransaction] : transactions,
                stats: {
                    totalIncome: grossIncome, // Now matches Dashboard "Ventas Totales"
                    // Prompt asked: "Ingresos Totales (Brutos)". So yes, gross.
                    totalExpenses: trueTotalExpenses, // Only explicit expenses
                    netIncome: grossIncome - trueTotalExpenses, // Corrected to include Rent deduction
                    servicesTotal,
                    tipsTotal,
                    productsTotal,
                    suppliesTotal,
                    commissionRentTotal
                }
            });

            showToast('Reporte descargado exitosamente', 'success');
        } catch (error) {
            console.error('Export error:', error);
            showToast('Error al generar el PDF', 'error');
        }
    };

    // WhatsApp / Native Share Handler (Cierre de Caja - Semanal o Mensual)
    const executeShare = async (periodType: 'weekly' | 'monthly') => {
        setShowShareModal(false);
        if (!user) {
            showToast('No hay sesión activa', 'error');
            return;
        }

        try {
            if (Capacitor.isNativePlatform()) {
                await Haptics.impact({ style: ImpactStyle.Medium });
            }
        } catch {}

        let filteredTxs: Transaction[] = [];
        let periodLabel = '';
        let calculatedRent = 0;

        if (periodType === 'weekly') {
            // Last 7 days in Santiago time
            const now = new Date();
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(now.getDate() - 7);
            
            // Fused data lookup across all available transactions
            const allTxs = await OfflineService.getFusedTransactions(user.id);
            filteredTxs = allTxs.filter(t => new Date(t.rawDate) >= sevenDaysAgo);
            periodLabel = `Últimos 7 Días (${formatInTimeZone(sevenDaysAgo, SANTIAGO_TZ, 'dd/MM')} - ${formatInTimeZone(now, SANTIAGO_TZ, 'dd/MM')})`;
            
            if (profileSettings?.expense_model === 'rent' && profileSettings.rent_amount > 0) {
                // If rent is monthly, weekly is 1/4; if weekly, full rent_amount
                calculatedRent = profileSettings.rent_period === 'weekly' 
                    ? profileSettings.rent_amount 
                    : Math.round(profileSettings.rent_amount / 4);
            }
        } else {
            // Monthly (selectedDate)
            filteredTxs = transactions;
            periodLabel = capitalizedMonth;
            
            if (profileSettings?.expense_model === 'rent' && profileSettings.rent_amount > 0) {
                const multiplier = profileSettings.rent_period === 'weekly' ? 4 : 1;
                calculatedRent = profileSettings.rent_amount * multiplier;
            }
        }

        if (filteredTxs.length === 0) {
            showToast('No hay movimientos en este periodo para compartir', 'info');
            return;
        }

        const shareIncome = filteredTxs
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        const shareExpenses = filteredTxs
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

        const shareSupplies = filteredTxs
            .filter(t => t.category === 'supply')
            .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

        const servicesCount = filteredTxs.filter(t => t.type === 'income' && t.category === 'service').length;
        const totalShareExpenses = shareExpenses + calculatedRent;
        const shareBalance = shareIncome - totalShareExpenses;

        let userNameToUse = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Barbero';

        const rentText = calculatedRent > 0
            ? `🏠 *Arriendo Salón:* ${format(calculatedRent)}\n`
            : '';

        const shareMessage = `💈 *REGISTBAR - ${periodType === 'weekly' ? 'CIERRE SEMANAL' : 'RESUMEN MENSUAL'}* 🇨🇱\n` +
            `👤 *Profesional:* ${userNameToUse}\n` +
            `📅 *Periodo:* ${periodLabel}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `💰 *Ingresos Totales:* ${format(shareIncome)}\n` +
            `✂️ *Servicios Realizados:* ${servicesCount} cortes\n` +
            `🛒 *Gastos en Insumos:* ${format(shareSupplies)}\n` +
            rentText +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `💵 *BALANCE NETO:* ${format(shareBalance)}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `✨ _Generado con RegistBar App_`;

        // Track Analytics Event (ANA-01)
        trackEvent('whatsapp_share_clicked', {
            period_type: periodType,
            services_count: servicesCount,
            net_balance_bucket: getBalanceBucket(shareBalance)
        });

        try {
            if (Capacitor.isNativePlatform()) {
                await Share.share({
                    title: `Cierre de Caja - ${periodLabel}`,
                    text: shareMessage,
                    dialogTitle: 'Compartir Cierre'
                });
                showToast('¡Cierre compartido!', 'success');
            } else if (navigator.share) {
                await navigator.share({
                    title: `Cierre de Caja - ${periodLabel}`,
                    text: shareMessage
                });
                showToast('¡Cierre compartido!', 'success');
            } else {
                const encoded = encodeURIComponent(shareMessage);
                window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
                showToast('Abriendo WhatsApp...', 'success');
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                try {
                    await navigator.clipboard.writeText(shareMessage);
                    showToast('Resumen copiado al portapapeles', 'success');
                } catch {
                    showToast('No se pudo compartir', 'error');
                }
            }
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in-up">
            {/* Header with Month Selection */}
            <div className="bg-white rounded-[2.5rem] p-6 shadow-soft">
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => changeMonth(-1)}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <Icon name="chevron_left" size={24} className="text-slate-400" />
                    </button>
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Periodo</span>
                        <h2 className="text-lg font-bold text-slate-900">{capitalizedMonth}</h2>
                    </div>
                    <button
                        onClick={() => changeMonth(1)}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <Icon name="chevron_right" size={24} className="text-slate-400" />
                    </button>
                </div>

                {/* Balance Summary */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-1 mb-1">
                            <Icon name="trending_up" size={12} className="text-green-500" />
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Ingresos</span>
                        </div>
                        <span className="text-sm font-black text-slate-900 truncate">{format(totalIncome)}</span>
                    </div>
                    <div className="flex flex-col p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-1 mb-1">
                            <Icon name="trending_down" size={12} className="text-red-500" />
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Egresos</span>
                        </div>
                        <span className="text-sm font-black text-slate-900 truncate">{format(totalExpenses)}</span>
                    </div>
                    <div className="flex flex-col p-3 bg-primary/10 rounded-2xl ring-1 ring-primary/20">
                        <div className="flex items-center gap-1 mb-1">
                            <Icon name="account_balance_wallet" size={12} className="text-primary" />
                            <span className="text-[9px] font-bold text-primary uppercase">Neto</span>
                        </div>
                        <span className="text-sm font-black text-primary truncate">{format(balance)}</span>
                    </div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Historial de Registros</h3>
                <div className="flex items-center gap-2">
                    <button
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 text-white rounded-full text-xs font-bold shadow-md shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95 cursor-pointer"
                        onClick={() => setShowShareModal(true)}
                        title="Compartir Cierre por WhatsApp"
                    >
                        <Icon name="share" size={15} />
                        <span>WhatsApp</span>
                    </button>
                    <button
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-600 hover:border-primary/30 hover:text-primary transition-all shadow-sm active:scale-95 cursor-pointer"
                        onClick={handleExport}
                        title="Exportar Reporte PDF"
                    >
                        <Icon name="download" size={15} />
                        <span>PDF</span>
                    </button>
                </div>
            </div>

            {/* Transactions List */}
            <div className="flex flex-col gap-3">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center shadow-soft">
                        <div className="p-4 bg-slate-50 rounded-full w-fit mx-auto mb-4 text-slate-300">
                            <Icon name="error_outline" size={32} />
                        </div>
                        <p className="text-slate-500 font-medium">No hay movimientos en este periodo</p>
                    </div>
                ) : (
                    transactions.map((tx) => (
                        <div
                            key={tx.id}
                            className="bg-white p-4 rounded-3xl shadow-soft flex items-center justify-between group active:scale-[0.98] transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl ${tx.type === 'income' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
                                    <Icon name={tx.icon} size={24} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-900">{tx.title}</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[10px] font-medium text-slate-400">{tx.date}</span>
                                        <div className="size-1 bg-slate-200 rounded-full"></div>
                                        <span className="text-[10px] font-medium text-slate-400 capitalize">{tx.category === 'service' ? 'servicio' : tx.category === 'tip' ? 'propina' : (tx.title && tx.title.includes('Aporte a Ahorro')) ? 'ahorro' : 'insumo'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className={`text-sm font-black ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                                    {tx.type === 'income' ? '+' : '-'} {format(Math.abs(tx.amount))}
                                </span>
                                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">{tx.time}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* REP-01: Modal Selector Cierre Semanal vs Mensual */}
            <AnimatePresence>
                {showShareModal && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 50 }}
                            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl flex flex-col gap-4 border border-slate-100"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                        <Icon name="share" size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-base">Compartir Cierre</h3>
                                        <p className="text-xs text-slate-400">Elige el periodo para WhatsApp</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowShareModal(false)}
                                    className="p-2 -mr-2 text-slate-400 hover:text-slate-700"
                                >
                                    <Icon name="close" size={20} />
                                </button>
                            </div>

                            <div className="flex flex-col gap-3 my-2">
                                <button
                                    onClick={() => executeShare('weekly')}
                                    className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 flex items-center justify-between text-left transition-all active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="size-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                                            <Icon name="date_range" size={18} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 text-sm">Cierre Semanal</p>
                                            <p className="text-[11px] text-slate-400">Últimos 7 días (ideal para rendir al salón)</p>
                                        </div>
                                    </div>
                                    <Icon name="chevron_right" size={18} className="text-slate-300" />
                                </button>

                                <button
                                    onClick={() => executeShare('monthly')}
                                    className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 flex items-center justify-between text-left transition-all active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="size-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                                            <Icon name="calendar_month" size={18} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 text-sm">Cierre Mensual</p>
                                            <p className="text-[11px] text-slate-400">{capitalizedMonth}</p>
                                        </div>
                                    </div>
                                    <Icon name="chevron_right" size={18} className="text-slate-300" />
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
