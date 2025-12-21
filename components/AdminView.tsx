import React, { useState, useEffect } from 'react';
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

interface User {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string;
}

export const AdminView: React.FC<AdminViewProps> = ({ onClose }) => {
    const { signOut } = useAuth();
    const { showToast } = useToast();
    const [view, setView] = useState<'tickets' | 'users'>('tickets');

    // Tickets State
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(true);
    const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'resolved'>('open');

    // Users State
    const [users, setUsers] = useState<User[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Undo System
    const [lastDeletedTicket, setLastDeletedTicket] = useState<Ticket | null>(null);
    const [deleteTimer, setDeleteTimer] = useState<NodeJS.Timeout | null>(null);

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

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const { data, error } = await supabase.rpc('get_admin_users');
            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error("Error fetching users:", error);
            showToast("Error al cargar usuarios (Requiere SQL function)", "error");
        } finally {
            setLoadingUsers(false);
        }
    };

    useEffect(() => {
        if (view === 'tickets') fetchTickets();
        if (view === 'users') fetchUsers();
    }, [view, ticketFilter]);

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

    const [replyingTo, setReplyingTo] = useState<number | null>(null);
    const [replyMessage, setReplyMessage] = useState("");
    const [sendingReply, setSendingReply] = useState(false);

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

            showToast("Respuesta enviada y ticket resuelto", "success");
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

    const handleDelete = async (ticket: Ticket) => {
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

    const handleRestore = () => {
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

    useEffect(() => {
        return () => {
            if (deleteTimer) clearTimeout(deleteTimer);
        };
    }, [deleteTimer]);

    return (
        <div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-slate-50 text-slate-900 overflow-hidden">
            {/* Sidebar (Desktop & Tablet) */}
            <div className="hidden md:flex w-20 lg:w-64 bg-slate-900 flex-col items-center lg:items-start py-8 lg:px-6 shrink-0 z-20">
                <div className="mb-8 flex items-center gap-3 text-white">
                    <div className="size-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <Icon name="admin_panel_settings" size={24} />
                    </div>
                    <div className="hidden lg:block leading-tight">
                        <h1 className="font-bold text-lg">Admin</h1>
                        <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Panel</p>
                    </div>
                </div>

                <div className="flex flex-col gap-2 w-full">
                    <button
                        onClick={() => setView('tickets')}
                        className={`p-3 lg:px-4 lg:py-3 rounded-xl flex items-center justify-center lg:justify-start gap-3 transition-all ${view === 'tickets' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                    >
                        <Icon name="help" size={20} />
                        <span className="hidden lg:block font-bold text-sm">Soporte</span>
                    </button>

                    <button
                        onClick={() => setView('users')}
                        className={`p-3 lg:px-4 lg:py-3 rounded-xl flex items-center justify-center lg:justify-start gap-3 transition-all ${view === 'users' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                    >
                        <Icon name="group" size={20} />
                        <span className="hidden lg:block font-bold text-sm">Usuarios</span>
                    </button>
                </div>

                <div className="mt-auto w-full">
                    <button
                        onClick={signOut}
                        className="p-3 lg:px-4 lg:py-3 rounded-xl flex items-center justify-center lg:justify-start gap-3 text-white/40 hover:text-white hover:bg-white/5 transition-colors w-full"
                    >
                        <Icon name="logout" size={20} className="rotate-180" />
                        <span className="hidden lg:block font-bold text-sm">Salir</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative pb-16 md:pb-0">
                {/* Header Mobile */}
                <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between shrink-0 shadow-lg z-10">
                    <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                            <Icon name="admin_panel_settings" size={18} />
                        </div>
                        <span className="font-bold">Admin Panel</span>
                    </div>
                    <button onClick={signOut} className="text-white/70">
                        <Icon name="logout" size={24} />
                    </button>
                </div>

                {/* View: TICKETS */}
                {view === 'tickets' && (
                    <>
                        <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                            <h2 className="text-xl font-bold text-slate-900">Tickets</h2>
                            <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
                                {(['open', 'resolved', 'all'] as const).map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setTicketFilter(f)}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${ticketFilter === f
                                            ? 'bg-slate-900 text-white'
                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                            }`}
                                    >
                                        {f === 'open' ? 'Pendientes' : f === 'resolved' ? 'Resueltos' : 'Todos'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 md:p-6">
                            {loadingTickets ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                                </div>
                            ) : tickets.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                                    <Icon name="inbox" size={48} className="mb-4" />
                                    <p className="font-medium">No hay tickets</p>
                                </div>
                            ) : (
                                <div className="grid gap-4 max-w-3xl mx-auto">
                                    <AnimatePresence>
                                        {lastDeletedTicket && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 50 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 50 }}
                                                className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 text-white"
                                            >
                                                <span className="text-sm font-medium">Ticket eliminado</span>
                                                <button
                                                    onClick={handleRestore}
                                                    className="text-indigo-400 font-bold text-sm hover:text-indigo-300 transition-colors uppercase tracking-wider"
                                                >
                                                    Deshacer
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {tickets.map((ticket) => (
                                        <div key={ticket.id} className="relative overflow-hidden rounded-2xl group">
                                            <div className="absolute inset-0 bg-gradient-to-l from-red-600 to-red-500 flex items-center justify-end pr-10">
                                                <div className="flex flex-col items-center gap-1 text-white opacity-80">
                                                    <Icon name="delete" size={28} />
                                                    <span className="text-[10px] font-bold uppercase tracking-tighter">Eliminar</span>
                                                </div>
                                            </div>

                                            <motion.div
                                                layout
                                                drag="x"
                                                dragConstraints={{ left: 0, right: 0 }}
                                                dragElastic={0.8}
                                                dragTransition={{ bounceStiffness: 400, bounceDamping: 20 }}
                                                whileDrag={{
                                                    scale: 0.98,
                                                    boxShadow: "0 10px 30px -10px rgb(0 0 0 / 0.2)",
                                                    cursor: "grabbing"
                                                }}
                                                onDragEnd={(_, info) => {
                                                    // Threshold with high elasticity
                                                    if (info.offset.x < -140 || info.velocity.x < -700) {
                                                        handleDelete(ticket);
                                                    }
                                                }}
                                                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3 relative z-10 touch-pan-y transition-shadow cursor-grab"
                                            >
                                                <div className="flex justify-between items-start">
                                                    <h3 className="font-bold text-lg text-slate-900 leading-tight">
                                                        {ticket.subject}
                                                    </h3>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ticket.status === 'open' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                                                        }`}>
                                                        {ticket.status === 'open' ? 'Pendiente' : 'Resuelto'}
                                                    </span>
                                                </div>

                                                <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">
                                                    {ticket.message}
                                                </p>

                                                {replyingTo === ticket.id ? (
                                                    <div className="mt-3 pt-3 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                                                        <textarea
                                                            value={replyMessage}
                                                            onChange={(e) => setReplyMessage(e.target.value)}
                                                            placeholder="Escribe tu respuesta..."
                                                            className="w-full p-3 rounded-xl border border-slate-200 text-black placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] bg-white"
                                                            autoFocus
                                                        />
                                                        <div className="flex justify-end gap-2 mt-2">
                                                            <button
                                                                onClick={() => {
                                                                    setReplyingTo(null);
                                                                    setReplyMessage("");
                                                                }}
                                                                className="px-3 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100"
                                                                disabled={sendingReply}
                                                            >
                                                                Cancelar
                                                            </button>
                                                            <button
                                                                onClick={() => handleSendReply(ticket)}
                                                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                                                disabled={sendingReply || !replyMessage.trim()}
                                                            >
                                                                {sendingReply ? "Enviando..." : "Enviar Respuesta"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="mt-2 pt-3 border-t border-slate-50 flex items-center justify-between">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-slate-700">{ticket.user_email}</span>
                                                            <span className="text-[10px] text-slate-400">
                                                                {new Date(ticket.created_at).toLocaleString('es-CL')}
                                                            </span>
                                                        </div>

                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    setReplyingTo(ticket.id);
                                                                    setReplyMessage("");
                                                                }}
                                                                className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors flex items-center gap-1"
                                                            >
                                                                <Icon name="mail" size={14} />
                                                                <span className="hidden sm:inline">Responder</span>
                                                            </button>
                                                            {ticket.status === 'open' && (
                                                                <button
                                                                    onClick={() => handleResolve(ticket.id)}
                                                                    className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 shadow-md shadow-green-500/20 transition-all flex items-center gap-1"
                                                                >
                                                                    <Icon name="check" size={14} />
                                                                    <span className="hidden sm:inline">Resolver</span>
                                                                </button>
                                                            )}
                                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100 opacity-60">
                                                                <Icon name="chevron_left" size={14} className="animate-pulse" />
                                                                <span className="text-[10px] font-bold uppercase tracking-tight text-slate-400">Deslizar para borrar</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* View: USERS */}
                {view === 'users' && (
                    <>
                        <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between shrink-0">
                            <h2 className="text-xl font-bold text-slate-900">Usuarios</h2>
                            <div className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">
                                Total: {users.length}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 md:p-6">
                            {loadingUsers ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                                </div>
                            ) : users.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                                    <Icon name="group" size={48} className="mb-4" />
                                    <p className="font-medium">No se encontraron usuarios</p>
                                </div>
                            ) : (
                                <>
                                    <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                        <table className="w-full text-left bg-white">
                                            <thead className="bg-slate-50 border-b border-slate-100">
                                                <tr>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Email</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Registrado</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Último Acceso</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {users.map((user) => (
                                                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="size-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                                                    {user.email.substring(0, 2).toUpperCase()}
                                                                </div>
                                                                <span className="text-sm font-bold text-slate-700">{user.email}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-sm text-slate-500">
                                                                {new Date(user.created_at).toLocaleDateString('es-CL')}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-sm text-slate-500">
                                                                {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('es-CL') : 'N/A'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="md:hidden flex flex-col gap-3">
                                        {users.map((user) => (
                                            <div key={user.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
                                                <div className="size-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                                                    {user.email.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-800 text-sm truncate">{user.email}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                                                            Reg: {new Date(user.created_at).toLocaleDateString('es-CL')}
                                                        </span>
                                                        {user.last_sign_in_at && (
                                                            <span className="text-[10px] text-slate-400">
                                                                Last: {new Date(user.last_sign_in_at).toLocaleDateString('es-CL')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Bottom Nav (Mobile Only) */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-[60] pb-safe">
                <button
                    onClick={() => setView('tickets')}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${view === 'tickets' ? 'text-indigo-600' : 'text-slate-400'
                        }`}
                >
                    <Icon name="help" size={24} weight={view === 'tickets' ? 'fill' : 'regular'} />
                    <span className="text-[10px] font-bold">Tickets</span>
                </button>
                <button
                    onClick={() => setView('users')}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${view === 'users' ? 'text-indigo-600' : 'text-slate-400'
                        }`}
                >
                    <Icon name="group" size={24} weight={view === 'users' ? 'fill' : 'regular'} />
                    <span className="text-[10px] font-bold">Usuarios</span>
                </button>
            </div>
        </div>
    );
};
