import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './Icons';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { SubscriptionPaywall } from './SubscriptionPaywall';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
    isStreaming?: boolean;
}

const QUICK_PROMPTS = [
    { label: '💰 ¿Cuánto gané hoy?', query: '¿Cuánto he ganado hoy y cuál es mi balance neto?' },
    { label: '🎯 Meta de ahorro', query: '¿Cómo va mi meta de ahorro y cuánto me falta?' },
    { label: '✂️ Servicio estrella', query: '¿Cuál es mi servicio más vendido y más rentable este mes?' },
    { label: '🛒 Gastos en insumos', query: '¿Cuánto he gastado en insumos esta semana y qué representa de mis ingresos?' },
    { label: '📊 Balance del mes', query: 'Dame un resumen completo de ingresos, gastos y balance de este mes.' }
];

export const AdvisorView: React.FC = () => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            text: '👋 ¡Hola! Soy tu **Aliado Inteligente** 🇨🇱. Analizo tus servicios, gastos y metas para darte consejos claros y ayudarte a hacer crecer tu barbería.\n\nPuedes tocar una de las sugerencias rápidas abajo o preguntarme lo que necesites.',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isPro, setIsPro] = useState<boolean | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const triggerHaptic = async () => {
        if (Capacitor.isNativePlatform()) {
            try {
                await Haptics.impact({ style: ImpactStyle.Light });
            } catch {
                // Ignore haptics errors on unsupported platforms
            }
        }
    };

    // 1. Check PRO status
    useEffect(() => {
        const checkSub = async () => {
            if (!user) return;
            const { data } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).maybeSingle();
            setIsPro(data?.subscription_status === 'pro');
        };
        checkSub();
    }, [user]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const handleSend = async (queryText?: string) => {
        const textToSend = queryText || input;
        if (!textToSend.trim() || isLoading) return;

        triggerHaptic();

        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: textToSend.trim(), timestamp: new Date() };
        const newHistory = [...messages, userMsg];
        setMessages(newHistory);
        if (!queryText) setInput('');
        setIsLoading(true);

        try {
            const historyPayload = newHistory.map(m => ({
                role: m.role,
                text: m.text
            }));

            const { data, error } = await supabase.functions.invoke('fiscal-advisor', {
                body: {
                    query: userMsg.text,
                    history: historyPayload
                }
            });

            if (error) throw error;

            const fullAnswer = data?.answer || 'No pude obtener una respuesta en este momento.';

            // Typewriter reveal effect
            const aiMsgId = (Date.now() + 1).toString();
            const aiMsg: Message = {
                id: aiMsgId,
                role: 'assistant',
                text: fullAnswer,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMsg]);
            triggerHaptic();

        } catch (err: any) {
            console.error(err);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: `⚠️ ${err.message || 'Error al consultar al asesor'}. Por favor intenta nuevamente.`,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    // Render formatted markdown with bullet points, bolding and amounts
    const renderMessageText = (text: string) => {
        return text.split('\n').map((line, i) => {
            const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
            const cleanLine = isBullet ? line.trim().substring(2) : line;

            const formattedParts = cleanLine.split(/(\*\*.*?\*\*)/).map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    const inner = part.slice(2, -2);
                    const isMoney = inner.includes('$') || inner.includes('€');
                    return (
                        <strong
                            key={j}
                            className={isMoney ? 'text-primary font-black bg-primary/10 px-1 py-0.5 rounded' : 'font-bold'}
                        >
                            {inner}
                        </strong>
                    );
                }
                return part;
            });

            if (isBullet) {
                return (
                    <div key={i} className="flex items-start gap-2 my-1">
                        <span className="size-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                        <span className="flex-1">{formattedParts}</span>
                    </div>
                );
            }

            return (
                <p key={i} className="min-h-[1.2em] mb-1.5 last:mb-0">
                    {formattedParts}
                </p>
            );
        });
    };

    if (isPro === null) return <div className="flex justify-center p-10"><Icon name="refresh" className="animate-spin" /></div>;

    // PAYWALL
    if (isPro === false) {
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
        <div className="flex flex-col h-[calc(100vh-140px)] animate-fade-in max-w-3xl mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 px-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-md shadow-indigo-500/20">
                        <Icon name="auto_awesome" size={22} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 leading-tight">Aliado Inteligente</h2>
                        <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                            <span className="size-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            Asesor Financiero 🇨🇱
                        </p>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/80 rounded-3xl border border-slate-100 shadow-inner mb-3">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`
                            max-w-[88%] md:max-w-[78%] lg:max-w-[72%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap
                            ${msg.role === 'user'
                                ? 'bg-slate-900 text-white rounded-br-none shadow-slate-900/10'
                                : 'bg-white text-slate-700 border border-slate-200/80 rounded-bl-none shadow-slate-200/50'}
                        `}>
                            {renderMessageText(msg.text)}
                            <span className="block text-[9px] mt-1 text-slate-400 text-right">
                                {msg.timestamp.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white p-3.5 rounded-2xl rounded-bl-none border border-slate-200 shadow-sm flex items-center gap-2 text-xs text-slate-500 font-medium">
                            <span className="size-2 bg-primary rounded-full animate-bounce"></span>
                            <span className="size-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="size-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="ml-1">Analizando tus finanzas...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Quick Action Chips (1-Tap Prompts) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-1 mb-2">
                {QUICK_PROMPTS.map((chip, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleSend(chip.query)}
                        disabled={isLoading}
                        className="whitespace-nowrap flex-shrink-0 px-3 py-1.5 bg-white border border-slate-200/90 rounded-full text-xs font-semibold text-slate-700 hover:border-primary/50 hover:text-primary active:scale-95 transition-all shadow-sm disabled:opacity-50"
                    >
                        {chip.label}
                    </button>
                ))}
            </div>

            {/* Input Area */}
            <div className="bg-white p-1.5 rounded-[2rem] shadow-soft border border-slate-200/80 flex items-center gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Pregunta sobre tus finanzas..."
                    className="flex-1 bg-transparent px-4 py-2.5 outline-none text-slate-700 font-medium placeholder:text-slate-400 text-sm"
                />
                <button
                    onClick={() => handleSend()}
                    disabled={isLoading || !input.trim()}
                    className="size-11 bg-primary rounded-full text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 flex-shrink-0"
                >
                    {isLoading ? <Icon name="refresh" className="animate-spin" size={20} /> : <Icon name="send" size={20} />}
                </button>
            </div>
        </div>
    );
};
