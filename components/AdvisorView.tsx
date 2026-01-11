
import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './Icons';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { SubscriptionPaywall } from './SubscriptionPaywall';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
}

export const AdvisorView: React.FC = () => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            text: '👋 Hola! Soy tu Asesor Financiero IA. Analizo tus transacciones y metas para darte consejos personalizados. ¿En qué te ayudo hoy?',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isPro, setIsPro] = useState<boolean | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 1. Check PRO status
    useEffect(() => {
        const checkSub = async () => {
            if (!user) return;
            const { data } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single();
            setIsPro(data?.subscription_status === 'pro');
        };
        checkSub();
    }, [user]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input, timestamp: new Date() };
        // Optimistic update
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        setInput('');
        setIsLoading(true);

        try {
            // Prepare history for backend (fail-safe map)
            const historyPayload = newHistory.map(m => ({
                role: m.role,
                text: m.text
            }));

            const { data, error } = await supabase.functions.invoke('fiscal-advisor', {
                body: {
                    query: userMsg.text,
                    history: historyPayload // Send full history
                }
            });

            if (error) throw error;

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: data.answer,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMsg]);

        } catch (err: any) {
            console.error(err);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: `⚠️ ${err.message || 'Error desconocido'}. Intenta de nuevo.`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper to render simple text with bolding and newlines
    const renderMessageText = (text: string) => {
        return text.split('\n').map((line, i) => (
            <p key={i} className="min-h-[1em] mb-1 last:mb-0">
                {line.split(/(\*\*.*?\*\*)/).map((part, j) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={j}>{part.slice(2, -2)}</strong>;
                    }
                    return part;
                })}
            </p>
        ));
    };

    if (isPro === null) return <div className="flex justify-center p-10"><Icon name="refresh" className="animate-spin" /></div>;

    // PAYWALL
    if (isPro === false) {
        // We show a teaser UI behind the paywall
        return (
            <div className="relative h-full overflow-hidden">
                <div className="absolute inset-0 filter blur-sm opacity-50 pointer-events-none p-4">
                    <div className="flex flex-col gap-4">
                        <div className="bg-slate-200 p-3 rounded-tl-xl rounded-tr-xl rounded-br-xl w-3/4 self-start">Hola, ¿cómo van mis ahorros?</div>
                        <div className="bg-primary/20 p-3 rounded-tl-xl rounded-tr-xl rounded-bl-xl w-3/4 self-end">Vas excelente. Llevas 40% de tu meta.</div>
                    </div>
                </div>
                <SubscriptionPaywall onClose={() => { }} featureName="Asesor IA" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 px-2">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg">
                    <Icon name="auto_awesome" size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Asesor Inteligente</h2>
                    <p className="text-xs text-green-600 font-bold flex items-center gap-1">
                        <span className="size-2 bg-green-500 rounded-full animate-pulse"></span>
                        En línea
                    </p>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner mb-4">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`
                            max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap
                            ${msg.role === 'user'
                                ? 'bg-slate-900 text-white rounded-br-none'
                                : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'}
                        `}>
                            {renderMessageText(msg.text)}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white p-4 rounded-2xl rounded-bl-none border border-slate-200 shadow-sm flex gap-2">
                            <span className="size-2 bg-slate-400 rounded-full animate-bounce"></span>
                            <span className="size-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="size-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white p-2 rounded-[2rem] shadow-soft border border-slate-100 flex items-center gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Pregunta sobre tus finanzas..."
                    className="flex-1 bg-transparent px-4 py-3 outline-none text-slate-700 font-medium placeholder:text-slate-400"
                />
                <button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="size-12 bg-primary rounded-full text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                >
                    {isLoading ? <Icon name="refresh" className="animate-spin" /> : <Icon name="send" />}
                </button>
            </div>
        </div>
    );
};
