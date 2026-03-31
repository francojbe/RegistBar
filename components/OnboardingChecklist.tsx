import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from './Icons';
import './OnboardingChecklist.css';

interface ChecklistItem {
    id: string;
    label: string;
    description: string;
    isCompleted: boolean;
    action: () => void;
    icon: string;
    successMetric: string;
}

interface OnboardingChecklistProps {
    userData: any;
    transactions: any[];
    onAction: (actionType: string) => void;
}

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({ userData, transactions, onAction }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [isExpanded, setIsExpanded] = useState(true);

    // If user has more than 3 transactions, they are already active. Hide the checklist.
    useEffect(() => {
        if (transactions.length >= 3) {
            setIsVisible(false);
        }
    }, [transactions]);

    if (!isVisible) return null;

    const items: ChecklistItem[] = [
        {
            id: 'first-service',
            label: 'Registra tu primer servicio',
            description: 'Calcula tu ganancia real en segundos.',
            isCompleted: transactions.some(t => t.category === 'service'),
            action: () => onAction('new-service'),
            icon: 'content_cut',
            successMetric: '+ $12,000 proyectados'
        },
        {
            id: 'advisor-chat',
            label: 'Habla con tu Asesor IA',
            description: 'Obtén consejos financieros personalizados.',
            isCompleted: false, // This could be synced with DB later
            action: () => onAction('advisor'),
            icon: 'smart_toy',
            successMetric: 'Ahorro inteligente'
        },
        {
            id: 'set-goal',
            label: 'Establece una meta',
            description: 'Ahorra para tus nuevas herramientas.',
            isCompleted: !!userData?.savings_goal,
            action: () => onAction('profile'),
            icon: 'savings',
            successMetric: 'Control total'
        }
    ];

    const completedCount = items.filter(i => i.isCompleted).length;
    const progress = (completedCount / items.length) * 100;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="onboarding-checklist-container mb-6"
        >
            <div className="bg-white rounded-[2rem] shadow-premium overflow-hidden border border-primary/10">
                {/* Header */}
                <div 
                    className="p-5 flex items-center justify-between cursor-pointer active:bg-slate-50 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-4">
                        <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                            <Icon name="verified" size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm">Tu camino al éxito ✂️</h3>
                            <p className="text-xs text-slate-400 font-medium">Completa {items.length - completedCount} tareas para dominar el negocio</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative size-12 flex items-center justify-center">
                            <svg className="size-12 -rotate-90">
                                <circle
                                    cx="24"
                                    cy="24"
                                    r="20"
                                    fill="transparent"
                                    stroke="#f1f5f9"
                                    strokeWidth="4"
                                />
                                <circle
                                    cx="24"
                                    cy="24"
                                    r="20"
                                    fill="transparent"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    strokeDasharray={125.6}
                                    strokeDashoffset={125.6 - (125.6 * progress) / 100}
                                    className="text-primary transition-all duration-1000"
                                />
                            </svg>
                            <span className="absolute text-[10px] font-black text-slate-900">{Math.round(progress)}%</span>
                        </div>
                        <Icon name={isExpanded ? "expand_less" : "expand_more"} size={20} className="text-slate-300" />
                    </div>
                </div>

                {/* Body */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-slate-50/50"
                        >
                            <div className="p-4 flex flex-col gap-3">
                                {items.map((item) => (
                                    <div 
                                        key={item.id}
                                        onClick={!item.isCompleted ? item.action : undefined}
                                        className={`flex items-center justify-between p-4 rounded-2xl bg-white border transition-all active:scale-[0.98] ${item.isCompleted ? 'border-green-100 opacity-70' : 'border-slate-100 shadow-sm'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`size-10 rounded-full flex items-center justify-center ${item.isCompleted ? 'bg-green-100 text-green-500' : 'bg-slate-100 text-slate-400'}`}>
                                                <Icon name={item.isCompleted ? "check" : item.icon} size={20} />
                                            </div>
                                            <div>
                                                <h4 className={`text-sm font-bold ${item.isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                                    {item.label}
                                                </h4>
                                                <p className="text-[10px] text-slate-400 font-medium">{item.description}</p>
                                            </div>
                                        </div>
                                        {!item.isCompleted && (
                                            <div className="bg-primary/5 text-primary text-[10px] font-bold px-2 py-1 rounded-lg">
                                                {item.successMetric}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 bg-primary/5 flex items-center justify-center gap-2">
                                <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">RegistBar Pro • v1.2</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};
