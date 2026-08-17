import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from './Icons';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

interface AdminViewProps {
    onClose: () => void;
}

interface Ticket {
    id: number;
    created_at: string;
    user_id: string;
    user_email: string;
    subject: string;
    message: string;
    status: 'open' | 'in_progress' | 'closed' | 'resolved';
}

interface ProfileUser {
    id: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    created_at?: string;
    expense_model?: string;
    commission_rate?: number;
    rent_amount?: number;
    subscription_status?: string;
    avatar_url?: string;
}

interface Announcement {
    id: number;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    is_active: boolean;
    created_at: string;
    user_id?: string | null;
}

interface AnalyticsEventRow {
    id: number;
    event_name: string;
    properties: any;
    created_at: string;
    user_id: string;
}

export const AdminView: React.FC<AdminViewProps> = ({ onClose }) => {
    const { signOut } = useAuth();
    const { showToast } = useToast();
    const [view, setView] = useState<'analytics' | 'announcements' | 'tickets' | 'users'>('analytics');

    // --- Analytics State ---
    const [events, setEvents] = useState<AnalyticsEventRow[]>([]);
    const [loadingAnalytics, setLoadingAnalytics] = useState(true);
    const [totalServicesCount, setTotalServicesCount] = useState(0);

    // --- Tickets State ---
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'resolved'>('open');
    const [replyingTo, setReplyingTo] = useState<number | null>(null);
    const [replyMessage, setReplyMessage] = useState("");
    const [sendingReply, setSendingReply] = useState(false);
    const [lastDeletedTicket, setLastDeletedTicket] = useState<Ticket | null>(null);
    const [deleteTimer, setDeleteTimer] = useState<NodeJS.Timeout | null>(null);

    // --- Users State ---
    const [users, setUsers] = useState<ProfileUser[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [userSearch, setUserSearch] = useState("");
    const [userPlanFilter, setUserPlanFilter] = useState<'all' | 'pro' | 'basic' | 'recent'>('all');
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

    // --- Announcements State ---
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
    const [showNewAnnouncementModal, setShowNewAnnouncementModal] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newMessage, setNewMessage] = useState("");
    const [newType, setNewType] = useState<'info' | 'success' | 'warning' | 'error'>('info');
    const [isSubmittingAnnouncement, setIsSubmittingAnnouncement] = useState(false);

    // 1. Fetch Analytics
    const fetchAnalytics = async () => {
        setLoadingAnalytics(true);
        try {
            const { data: eventsData, error: eventsError } = await supabase
                .from('analytics_events')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200);

            if (!eventsError && eventsData) {
                setEvents(eventsData);
            }

            const { count: txCount } = await supabase
                .from('transactions')
                .select('*', { count: 'exact', head: true })
                .eq('type', 'income');

            setTotalServicesCount(txCount || 0);
        } catch (err) {
            console.error("Error fetching analytics:", err);
        } finally {
            setLoadingAnalytics(false);
        }
    };

    // 2. Fetch Tickets
    const fetchTickets = async () => {
        setLoadingTickets(true);
        try {
            let query = supabase
                .from('support_tickets')
                .select('*')
                .order('created_at', { ascending: false });

            if (ticketFilter === 'open') {
                query = query.eq('status', 'open');
            } else if (ticketFilter === 'resolved') {
                query = query.in('status', ['resolved', 'closed']);
            }

            const { data, error } = await query;
            if (error) throw error;
            setTickets(data || []);
        } catch (error) {
            console.error("Error fetching tickets:", error);
            showToast("Error al cargar tickets", "error");
        } finally {
            setLoadingTickets(false);
        }
    };

    // 3. Fetch Users
    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, email, first_name, last_name, full_name, created_at, expense_model, commission_rate, rent_amount, subscription_status, avatar_url')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error("Error fetching users:", error);
            showToast("Error al cargar usuarios", "error");
        } finally {
            setLoadingUsers(false);
        }
    };

    // 4. Fetch Announcements
    const fetchAnnouncements = async () => {
        setLoadingAnnouncements(true);
        try {
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAnnouncements(data || []);
        } catch (error) {
            console.error("Error fetching announcements:", error);
            showToast("Error al cargar comunicados", "error");
        } finally {
            setLoadingAnnouncements(false);
        }
    };

    useEffect(() => {
        if (view === 'analytics') fetchAnalytics();
        if (view === 'tickets') fetchTickets();
        if (view === 'users') fetchUsers();
        if (view === 'announcements') fetchAnnouncements();
    }, [view, ticketFilter]);

    // Analytics Summary Calculations
    const stats = useMemo(() => {
        const totalAppOpens = events.filter(e => e.event_name === 'app_install_opened').length;
        const ocrAttempts = events.filter(e => e.event_name === 'ocr_scan_attempted').length;
        const ocrConfirmed = events.filter(e => e.event_name === 'ocr_scan_confirmed').length;
        const ocrSuccessRate = ocrAttempts > 0 ? Math.round((ocrConfirmed / ocrAttempts) * 100) : 100;
        const aiPrompts = events.filter(e => e.event_name === 'ai_advisor_prompted').length;
        const totalOnboarded = events.filter(e => e.event_name === 'onboarding_completed').length;
        const privacyToggles = events.filter(e => e.event_name === 'privacy_mode_toggled').length;

        // Platform breakdown
        const androidEvents = events.filter(e => e.properties?.platform === 'android').length;
        const webEvents = events.filter(e => e.properties?.platform === 'pwa_web').length;
        const totalEventsCount = events.length || 1;
        const androidPct = Math.round((androidEvents / totalEventsCount) * 100);
        const webPct = 100 - androidPct;

        return {
            totalAppOpens,
            ocrAttempts,
            ocrConfirmed,
            ocrSuccessRate,
            aiPrompts,
            totalOnboarded,
            privacyToggles,
            androidPct,
            webPct
        };
    }, [events]);

    // User Plan Update Handler (1-Click)
    const handleUpdateUserPlan = async (userId: string, newPlan: string) => {
        setUpdatingUserId(userId);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ subscription_status: newPlan })
                .eq('id', userId);

            if (error) throw error;

            setUsers(prev => prev.map(u => u.id === userId ? { ...u, subscription_status: newPlan } : u));
            showToast(`Plan actualizado a: ${newPlan.toUpperCase()}`, "success");
        } catch (err: any) {
            console.error("Error updating plan:", err);
            showToast("Error al actualizar el plan", "error");
        } finally {
            setUpdatingUserId(null);
        }
    };

    // Filtered Users
    const filteredUsers = useMemo(() => {
        let result = users;

        // Search Filter
        if (userSearch.trim()) {
            const q = userSearch.toLowerCase();
            result = result.filter(u => 
                (u.email && u.email.toLowerCase().includes(q)) ||
                (u.full_name && u.full_name.toLowerCase().includes(q)) ||
                (u.first_name && u.first_name.toLowerCase().includes(q))
            );
        }

        // Plan / Segment Filter
        if (userPlanFilter === 'pro') {
            result = result.filter(u => u.subscription_status === 'pro' || u.subscription_status === 'vip');
        } else if (userPlanFilter === 'basic') {
            result = result.filter(u => !u.subscription_status || u.subscription_status === 'basic' || u.subscription_status === 'free');
        } else if (userPlanFilter === 'recent') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            result = result.filter(u => u.created_at && new Date(u.created_at) >= sevenDaysAgo);
        }

        return result;
    }, [users, userSearch, userPlanFilter]);

    // Ticket Actions
    const handleResolve = async (id: number) => {
        try {
            const { error } = await supabase
                .from('support_tickets')
                .update({ status: 'resolved' })
                .eq('id', id);

            if (error) throw error;
            showToast("Ticket marcado como resuelto", "success");
            setTickets(prev => prev.filter(t => t.id !== id));
        } catch (error) {
            console.error("Error resolving ticket:", error);
            showToast("Error al actualizar ticket", "error");
        }
    };

    const handleSendReply = async (ticket: Ticket) => {
        if (!replyMessage.trim()) return;
        setSendingReply(true);
        try {
            const { error: notifError } = await supabase
                .from('announcements')
                .insert({
                    title: `Respuesta Spt: ${ticket.subject}`,
                    message: replyMessage,
                    type: 'info',
                    is_active: true,
                    user_id: ticket.user_id
                });

            if (notifError) throw notifError;

            const { error: ticketError } = await supabase
                .from('support_tickets')
                .update({ status: 'resolved' })
                .eq('id', ticket.id);

            if (ticketError) throw ticketError;

            showToast("Respuesta enviada al usuario", "success");
            setReplyMessage("");
            setReplyingTo(null);
            setTickets(prev => prev.filter(t => t.id !== ticket.id));
        } catch (error) {
            console.error("Error sending reply:", error);
            showToast("Error al enviar respuesta", "error");
        } finally {
            setSendingReply(false);
        }
    };

    const handleDeleteTicket = async (ticket: Ticket) => {
        setLastDeletedTicket(ticket);
        setTickets(prev => prev.filter(t => t.id !== ticket.id));
        showToast("Ticket eliminado", "info");

        const timer = setTimeout(async () => {
            const { error } = await supabase
                .from('support_tickets')
                .delete()
                .eq('id', ticket.id);

            if (error) console.error("Error deleting ticket:", error);
            setLastDeletedTicket(null);
            setDeleteTimer(null);
        }, 5000);

        setDeleteTimer(timer);
    };

    const handleRestoreTicket = () => {
        if (lastDeletedTicket) {
            if (deleteTimer) clearTimeout(deleteTimer);
            setTickets(prev => [lastDeletedTicket, ...prev].sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            ));
            setLastDeletedTicket(null);
            setDeleteTimer(null);
            showToast("Ticket restaurado", "success");
        }
    };

    // Announcement Actions
    const handleCreateAnnouncement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim() || !newMessage.trim()) return;

        setIsSubmittingAnnouncement(true);
        try {
            const { data, error } = await supabase
                .from('announcements')
                .insert({
                    title: newTitle.trim(),
                    message: newMessage.trim(),
                    type: newType,
                    is_active: true,
                    user_id: null // Global
                })
                .select()
                .single();

            if (error) throw error;

            showToast("¡Anuncio global publicado!", "success");
            setAnnouncements(prev => [data, ...prev]);
            setNewTitle("");
            setNewMessage("");
            setShowNewAnnouncementModal(false);
        } catch (err: any) {
            console.error("Error publishing announcement:", err);
            showToast(`Error al publicar: ${err.message || err}`, "error");
        } finally {
            setIsSubmittingAnnouncement(false);
        }
    };

    const handleToggleAnnouncement = async (ann: Announcement) => {
        try {
            const { error } = await supabase
                .from('announcements')
                .update({ is_active: !ann.is_active })
                .eq('id', ann.id);

            if (error) throw error;
            setAnnouncements(prev => prev.map(a => a.id === ann.id ? { ...a, is_active: !a.is_active } : a));
            showToast(ann.is_active ? "Anuncio pausado" : "Anuncio activado", "info");
        } catch (err) {
            showToast("Error al actualizar anuncio", "error");
        }
    };

    const handleDeleteAnnouncement = async (id: number) => {
        if (!confirm("¿Seguro que deseas eliminar este anuncio?")) return;
        try {
            const { error } = await supabase
                .from('announcements')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setAnnouncements(prev => prev.filter(a => a.id !== id));
            showToast("Anuncio eliminado", "success");
        } catch (err) {
            showToast("Error al eliminar anuncio", "error");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col md:flex-row bg-slate-900 text-slate-100 overflow-hidden font-sans">
            {/* Sidebar (Desktop) */}
            <div className="hidden md:flex w-64 bg-slate-950/80 border-r border-slate-800/80 flex-col py-6 px-4 shrink-0 z-20">
                <div className="mb-6 flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                            <Icon name="admin_panel_settings" size={22} className="text-white" />
                        </div>
                        <div>
                            <h1 className="font-black text-white text-base leading-none">RegistBar</h1>
                            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-0.5">Admin Master</p>
                        </div>
                    </div>
                </div>

                {/* Nav Links */}
                <div className="flex flex-col gap-1.5 w-full">
                    {[
                        { id: 'analytics', label: 'Telemetría & Métricas', icon: 'analytics' },
                        { id: 'announcements', label: 'Anuncios Globales', icon: 'campaign' },
                        { id: 'tickets', label: 'Soporte & Tickets', icon: 'help' },
                        { id: 'users', label: 'Barberos & Planes', icon: 'group' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setView(tab.id as any)}
                            className={`px-3.5 py-3 rounded-2xl flex items-center gap-3 font-bold text-sm transition-all cursor-pointer ${
                                view === tab.id
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                            }`}
                        >
                            <Icon name={tab.icon} size={20} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Bottom Close / Signout */}
                <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-slate-800">
                    <button
                        onClick={onClose}
                        className="px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-slate-300 hover:bg-slate-800 font-bold text-sm transition-colors cursor-pointer"
                    >
                        <Icon name="arrow_back" size={18} />
                        <span>Volver a la App</span>
                    </button>
                    <button
                        onClick={signOut}
                        className="px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-rose-400 hover:bg-rose-500/10 font-bold text-sm transition-colors cursor-pointer"
                    >
                        <Icon name="logout" size={18} />
                        <span>Cerrar Sesión</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full bg-slate-900 overflow-hidden relative pb-16 md:pb-0">
                {/* Header Mobile */}
                <div className="md:hidden bg-slate-950 border-b border-slate-800 p-4 flex items-center justify-between shrink-0 shadow-lg z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-xl bg-indigo-600 flex items-center justify-center">
                            <Icon name="admin_panel_settings" size={18} className="text-white" />
                        </div>
                        <span className="font-extrabold text-sm text-white">Panel Administrador</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 active:scale-95"
                    >
                        <Icon name="close" size={20} />
                    </button>
                </div>

                {/* 1. VIEW: ANALYTICS & TELEMETRY */}
                {view === 'analytics' && (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col gap-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h2 className="text-2xl font-black text-white">Telemetría & Métricas en Vivo</h2>
                                <p className="text-xs text-slate-400">Datos reales y anónimos recopilados de la interacción de los usuarios.</p>
                            </div>
                            <button
                                onClick={fetchAnalytics}
                                className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                            >
                                <Icon name="refresh" size={16} />
                                <span>Actualizar</span>
                            </button>
                        </div>

                        {/* Top KPI Cards Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            <div className="bg-slate-800/70 border border-slate-700/60 p-4 rounded-2xl flex flex-col justify-between">
                                <div className="size-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2">
                                    <Icon name="group" size={20} />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase">Barberos</p>
                                    <p className="text-2xl font-black text-white">{users.length || '-'}</p>
                                </div>
                            </div>

                            <div className="bg-slate-800/70 border border-slate-700/60 p-4 rounded-2xl flex flex-col justify-between">
                                <div className="size-9 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center mb-2">
                                    <Icon name="content_cut" size={20} />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase">Servicios Totales</p>
                                    <p className="text-2xl font-black text-white">{totalServicesCount}</p>
                                </div>
                            </div>

                            <div className="bg-slate-800/70 border border-slate-700/60 p-4 rounded-2xl flex flex-col justify-between">
                                <div className="size-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-2">
                                    <Icon name="document_scanner" size={20} />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase">Precisión Escáner IA</p>
                                    <p className="text-2xl font-black text-white">{stats.ocrSuccessRate}%</p>
                                    <p className="text-[10px] text-slate-500">{stats.ocrConfirmed} confirmados / {stats.ocrAttempts} intentos</p>
                                </div>
                            </div>

                            <div className="bg-slate-800/70 border border-slate-700/60 p-4 rounded-2xl flex flex-col justify-between">
                                <div className="size-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2">
                                    <Icon name="auto_awesome" size={20} />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase">Consultas Asesor IA</p>
                                    <p className="text-2xl font-black text-white">{stats.aiPrompts}</p>
                                </div>
                            </div>
                        </div>

                        {/* Breakdown Insights */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Platform Distribution */}
                            <div className="bg-slate-800/60 border border-slate-700/60 p-5 rounded-2xl flex flex-col gap-3">
                                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                    <Icon name="devices" size={18} className="text-indigo-400" />
                                    <span>Distribución de Plataformas</span>
                                </h3>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <div className="flex justify-between text-xs mb-1 font-bold">
                                            <span className="text-emerald-400">📱 Android ({stats.androidPct}%)</span>
                                            <span className="text-sky-400">🌐 Web PWA ({stats.webPct}%)</span>
                                        </div>
                                        <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden flex">
                                            <div style={{ width: `${stats.androidPct}%` }} className="bg-emerald-500 transition-all duration-500"></div>
                                            <div style={{ width: `${stats.webPct}%` }} className="bg-sky-500 transition-all duration-500"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Privacy Mode Usage */}
                            <div className="bg-slate-800/60 border border-slate-700/60 p-5 rounded-2xl flex flex-col justify-between">
                                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                    <Icon name="visibility_off" size={18} className="text-indigo-400" />
                                    <span>Uso de Modo Privacidad (Ojo)</span>
                                </h3>
                                <div className="flex items-center justify-between mt-2">
                                    <div>
                                        <p className="text-2xl font-black text-white">{stats.privacyToggles}</p>
                                        <p className="text-[10px] text-slate-400">Veces que se activó/desactivó el modo discreto</p>
                                    </div>
                                    <span className="text-xs px-2.5 py-1 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-800/50 font-bold">
                                        Alta demanda
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Recent Telemetry Events Log */}
                        <div className="bg-slate-800/50 border border-slate-700/60 rounded-3xl p-5 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-base text-white flex items-center gap-2">
                                    <Icon name="sensors" size={18} className="text-indigo-400" />
                                    <span>Últimos Eventos de Telemetría</span>
                                </h3>
                                <span className="text-xs text-slate-400 font-semibold">{events.length} eventos recientes</span>
                            </div>

                            {loadingAnalytics ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                                </div>
                            ) : events.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-6">No hay eventos registrados aún.</p>
                            ) : (
                                <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                                    {events.map((evt) => (
                                        <div
                                            key={evt.id}
                                            className="bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between text-xs"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded-md border border-indigo-800/50">
                                                    {evt.event_name}
                                                </span>
                                                <span className="text-slate-400 text-[11px]">
                                                    {evt.properties?.platform === 'android' ? '📱 Android' : '🌐 Web PWA'}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-slate-500">
                                                {new Date(evt.created_at).toLocaleString('es-CL')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 2. VIEW: GLOBAL ANNOUNCEMENTS */}
                {view === 'announcements' && (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-white">Anuncios Globales</h2>
                                <p className="text-xs text-slate-400">Emite comunicados instantáneos a la campana de notificaciones de todos los barberos.</p>
                            </div>
                            <button
                                onClick={() => setShowNewAnnouncementModal(true)}
                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 active:scale-95 transition-all cursor-pointer"
                            >
                                <Icon name="add" size={18} />
                                <span>Nuevo Anuncio</span>
                            </button>
                        </div>

                        {loadingAnnouncements ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                            </div>
                        ) : announcements.length === 0 ? (
                            <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-12 text-center flex flex-col items-center gap-2">
                                <Icon name="campaign" size={40} className="text-slate-600" />
                                <p className="font-bold text-slate-400 text-sm">No has publicado anuncios globales aún</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {announcements.map((ann) => (
                                    <div
                                        key={ann.id}
                                        className={`bg-slate-800/80 border p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                                            ann.is_active ? 'border-slate-700' : 'border-slate-800 opacity-60'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3.5">
                                            <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                ann.type === 'success' ? 'bg-green-500/20 text-green-400' :
                                                ann.type === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                                                ann.type === 'error' ? 'bg-rose-500/20 text-rose-400' : 'bg-indigo-500/20 text-indigo-400'
                                            }`}>
                                                <Icon name="campaign" size={20} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-bold text-white text-base">{ann.title}</h4>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                                        ann.is_active ? 'bg-green-950 text-green-400 border border-green-800/40' : 'bg-slate-700 text-slate-400'
                                                    }`}>
                                                        {ann.is_active ? 'Activo' : 'Pausado'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-300 whitespace-pre-wrap">{ann.message}</p>
                                                <p className="text-[10px] text-slate-500 mt-2">{new Date(ann.created_at).toLocaleString('es-CL')}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 self-end sm:self-center">
                                            <button
                                                onClick={() => handleToggleAnnouncement(ann)}
                                                className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
                                            >
                                                {ann.is_active ? 'Pausar' : 'Activar'}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteAnnouncement(ann.id)}
                                                className="p-1.5 rounded-xl bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors cursor-pointer"
                                                title="Eliminar"
                                            >
                                                <Icon name="delete" size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 3. VIEW: SUPPORT TICKETS */}
                {view === 'tickets' && (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col gap-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-2xl font-black text-white">Tickets de Soporte</h2>
                                <p className="text-xs text-slate-400">Atiende dudas y responde directamente a la app de tus usuarios.</p>
                            </div>
                            <div className="flex gap-1.5 bg-slate-800 p-1 rounded-xl self-start sm:self-auto">
                                {(['open', 'resolved', 'all'] as const).map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setTicketFilter(f)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            ticketFilter === f ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        {f === 'open' ? 'Pendientes' : f === 'resolved' ? 'Resueltos' : 'Todos'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {loadingTickets ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                            </div>
                        ) : tickets.length === 0 ? (
                            <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-12 text-center flex flex-col items-center gap-2">
                                <Icon name="inbox" size={40} className="text-slate-600" />
                                <p className="font-bold text-slate-400 text-sm">No hay tickets en esta sección</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {tickets.map((ticket) => (
                                    <div
                                        key={ticket.id}
                                        className="bg-slate-800/80 border border-slate-700/80 p-5 rounded-2xl flex flex-col gap-3"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-bold text-white text-base">{ticket.subject}</h4>
                                                <p className="text-xs text-slate-400">{ticket.user_email}</p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                                ticket.status === 'open' ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'
                                            }`}>
                                                {ticket.status === 'open' ? 'Pendiente' : 'Resuelto'}
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-300 whitespace-pre-wrap bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                                            {ticket.message}
                                        </p>

                                        {replyingTo === ticket.id ? (
                                            <div className="flex flex-col gap-2 pt-2 border-t border-slate-700">
                                                <textarea
                                                    value={replyMessage}
                                                    onChange={(e) => setReplyMessage(e.target.value)}
                                                    placeholder="Escribe tu respuesta para el usuario..."
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-500"
                                                    rows={3}
                                                    autoFocus
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setReplyingTo(null)}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:bg-slate-700 cursor-pointer"
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSendReply(ticket)}
                                                        disabled={sendingReply || !replyMessage.trim()}
                                                        className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
                                                    >
                                                        {sendingReply ? 'Enviando...' : 'Enviar Respuesta'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between pt-2 border-t border-slate-700/60">
                                                <span className="text-[10px] text-slate-500">
                                                    {new Date(ticket.created_at).toLocaleString('es-CL')}
                                                </span>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setReplyingTo(ticket.id);
                                                            setReplyMessage("");
                                                        }}
                                                        className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-bold text-slate-200 flex items-center gap-1 cursor-pointer"
                                                    >
                                                        <Icon name="mail" size={14} />
                                                        <span>Responder</span>
                                                    </button>
                                                    {ticket.status === 'open' && (
                                                        <button
                                                            onClick={() => handleResolve(ticket.id)}
                                                            className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <Icon name="check" size={14} />
                                                            <span>Resolver</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteTicket(ticket)}
                                                        className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 cursor-pointer"
                                                    >
                                                        <Icon name="delete" size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 4. VIEW: REGISTERED USERS & PLAN MANAGEMENT */}
                {view === 'users' && (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col gap-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-2xl font-black text-white">Barberos & Gestión de Planes</h2>
                                <p className="text-xs text-slate-400">Administra cuentas, activa planes Pro y revisa modelos de negocio.</p>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    placeholder="Buscar por email o nombre..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        {/* Plan Filters Pills */}
                        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                            {[
                                { id: 'all', label: `Todos (${users.length})` },
                                { id: 'pro', label: `Plan Pro / VIP (${users.filter(u => u.subscription_status === 'pro' || u.subscription_status === 'vip').length})` },
                                { id: 'basic', label: `Básico / Free (${users.filter(u => !u.subscription_status || u.subscription_status === 'basic' || u.subscription_status === 'free').length})` },
                                { id: 'recent', label: 'Nuevos (Últimos 7 días)' }
                            ].map((f) => (
                                <button
                                    key={f.id}
                                    onClick={() => setUserPlanFilter(f.id as any)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                                        userPlanFilter === f.id
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {loadingUsers ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-12 text-center">
                                <p className="font-bold text-slate-400 text-sm">No se encontraron barberos con este filtro.</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {filteredUsers.map((u) => (
                                    <div
                                        key={u.id}
                                        className="bg-slate-800/80 border border-slate-700/80 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <div className="size-11 rounded-full bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-black text-sm shrink-0">
                                                {u.email ? u.email.substring(0, 2).toUpperCase() : 'U'}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-white text-sm truncate">
                                                    {u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}
                                                </p>
                                                <p className="text-xs text-slate-400 truncate">{u.email}</p>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-slate-400 font-medium">
                                                        {u.expense_model === 'rent' ? `$ Arriendo` : `${u.commission_rate || 40}% Comisión`}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500">
                                                        Registrado: {u.created_at ? new Date(u.created_at).toLocaleDateString('es-CL') : 'N/A'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 1-Click Plan Selector */}
                                        <div className="flex items-center gap-2 self-end sm:self-center bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
                                            <span className="text-[10px] font-bold text-slate-500 px-1 uppercase tracking-wider">Plan:</span>
                                            <select
                                                value={u.subscription_status || 'free'}
                                                onChange={(e) => handleUpdateUserPlan(u.id, e.target.value)}
                                                disabled={updatingUserId === u.id}
                                                className={`bg-slate-800 text-xs font-bold rounded-lg px-2.5 py-1 border outline-none cursor-pointer ${
                                                    u.subscription_status === 'pro' || u.subscription_status === 'vip'
                                                        ? 'text-emerald-400 border-emerald-500/30'
                                                        : 'text-indigo-300 border-indigo-500/30'
                                                }`}
                                            >
                                                <option value="free">Básico / Free</option>
                                                <option value="pro">Plan Pro ⭐</option>
                                                <option value="vip">Plan VIP 👑</option>
                                                <option value="inactive">Inactivo</option>
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Mobile Bottom Navigation for Admin */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 flex justify-around p-2 z-[60]">
                {[
                    { id: 'analytics', label: 'Métricas', icon: 'analytics' },
                    { id: 'announcements', label: 'Anuncios', icon: 'campaign' },
                    { id: 'tickets', label: 'Tickets', icon: 'help' },
                    { id: 'users', label: 'Planes', icon: 'group' },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setView(tab.id as any)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors cursor-pointer ${
                            view === tab.id ? 'text-indigo-400 font-bold' : 'text-slate-500'
                        }`}
                    >
                        <Icon name={tab.icon} size={22} />
                        <span className="text-[10px]">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Modal: Create Announcement */}
            {showNewAnnouncementModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <form
                        onSubmit={handleCreateAnnouncement}
                        className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4"
                    >
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
                                <Icon name="campaign" size={22} />
                            </div>
                            <div>
                                <h3 className="font-extrabold text-white text-lg">Nuevo Anuncio Global</h3>
                                <p className="text-xs text-slate-400">Llegará a todos los barberos en su campana.</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-400">Título</label>
                            <input
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder="Ej: Nueva función disponible..."
                                required
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-400">Mensaje</label>
                            <textarea
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Escribe el contenido del comunicado..."
                                required
                                rows={3}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-400">Tipo de Alerta</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'info', label: 'ℹ️ Info' },
                                    { id: 'success', label: '🚀 Novedad' },
                                    { id: 'warning', label: '⚠️ Alerta' },
                                ].map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setNewType(t.id as any)}
                                        className={`py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                            newType === t.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2 mt-2">
                            <button
                                type="button"
                                onClick={() => setShowNewAnnouncementModal(false)}
                                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-400 cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmittingAnnouncement}
                                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
                            >
                                {isSubmittingAnnouncement ? 'Publicando...' : 'Publicar Ahora'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};
