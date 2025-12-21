import React, { createContext, useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '../components/Icons';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = (message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000); // Auto dismiss after 4 seconds
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <ToastItem key={toast.id} {...toast} onClose={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))} />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};

const ToastItem: React.FC<Toast & { onClose: () => void }> = ({ message, type, onClose }) => {
    const getStyles = () => {
        switch (type) {
            case 'success':
                return 'bg-emerald-500 text-white shadow-emerald-500/30';
            case 'error':
                return 'bg-red-500 text-white shadow-red-500/30';
            default:
                return 'bg-slate-800 text-white shadow-slate-500/30';
        }
    };

    const getIcon = () => {
        switch (type) {
            case 'success': return 'check_circle';
            case 'error': return 'warning';
            default: return 'info';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            layout
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg backdrop-blur-md max-w-sm w-full font-bold text-sm ${getStyles()}`}
        >
            <Icon name={getIcon()} size={20} className="shrink-0" />
            <p className="flex-1 leading-tight">{message}</p>
            {/* Optional Close Button (or simplistic auto-close only) */}
        </motion.div>
    );
};
