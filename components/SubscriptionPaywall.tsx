
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from './Icons';

interface SubscriptionPaywallProps {
    onClose: () => void;
    featureName?: string;
}

export const SubscriptionPaywall: React.FC<SubscriptionPaywallProps> = ({ onClose, featureName = "Scanner" }) => {

    const handleSubscribe = () => {
        // Here we would trigger the payment flow
        // For now, let's open a WhatsApp link or show an alert
        window.open('https://wa.me/56912345678?text=Hola,%20quiero%20el%20Plan%20PRO%20de%20RegistBar', '_blank');
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4"
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl relative"
            >
                {/* Header Image / Gradient */}
                <div className="h-32 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-800 relative flex items-center justify-center">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                    <div className="size-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-xl">
                        <Icon name="diamond" size={40} className="text-yellow-400 drop-shadow-md" />
                    </div>

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
                    >
                        <Icon name="close" size={24} />
                    </button>
                </div>

                <div className="p-6 text-center">
                    <h2 className="text-2xl font-black text-slate-900 mb-1">RegistBar <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">PRO</span></h2>
                    <p className="text-sm text-slate-500 mb-6">Desbloquea el poder total de tu negocio</p>

                    <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left space-y-3 border border-slate-100">
                        <div className="flex items-start gap-3">
                            <div className="p-1 rounded-full bg-green-100 text-green-600 mt-0.5">
                                <Icon name="check" size={14} />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">Scanner de Facturas IA</h4>
                                <p className="text-xs text-slate-500">Digitaliza gastos en 1 segundo.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-1 rounded-full bg-green-100 text-green-600 mt-0.5">
                                <Icon name="check" size={14} />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">Asesor Financiero IA</h4>
                                <p className="text-xs text-slate-500">Chat inteligente con tus datos.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-1 rounded-full bg-green-100 text-green-600 mt-0.5">
                                <Icon name="check" size={14} />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">Metas Ilimitadas</h4>
                                <p className="text-xs text-slate-500">Planifica vacaciones, auto y más.</p>
                            </div>
                        </div>
                    </div>

                    <div className="mb-6">
                        <span className="text-3xl font-black text-slate-900">$2.990</span>
                        <span className="text-sm text-slate-400 font-bold"> / mes</span>
                    </div>

                    <button
                        onClick={handleSubscribe}
                        className="w-full py-4 rounded-xl bg-slate-900 text-white font-bold text-lg shadow-lg hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        Activar Plan PRO
                        <Icon name="arrow_forward" size={20} />
                    </button>

                    <p className="text-[10px] text-slate-400 mt-4">
                        Cancela cuando quieras. Plan mensual autorenovable.
                    </p>
                </div>
            </motion.div>
        </motion.div>
    );
};
