import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { App } from '@capacitor/app';
import { Icon } from './Icons';

export const UpdateChecker: React.FC = () => {
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [updateMessage, setUpdateMessage] = useState('Hay una nueva versión disponible con mejoras y correcciones.');
    const [isForced, setIsForced] = useState(false);

    useEffect(() => {
        checkForUpdates();
    }, []);

    const checkForUpdates = async () => {
        try {
            // Get current app version info
            const appInfo = await App.getInfo();
            const currentVersionCode = parseInt(appInfo.build);

            // Fetch version control from Supabase
            const { data, error } = await supabase
                .from('app_version_control')
                .select('*')
                .eq('platform', 'android')
                .single();

            if (error || !data) {
                console.error('Error fetching version control:', error);
                return;
            }

            const { min_version_code, force_update, update_message } = data;

            // Check if update is needed
            if (currentVersionCode < min_version_code) {
                setUpdateMessage(update_message || 'Por favor actualiza RegistBar para continuar usando la aplicación.');
                setIsForced(force_update);
                setShowUpdateModal(true);
            }
        } catch (err) {
            console.error('Error checking for updates:', err);
        }
    };

    const handleUpdate = () => {
        // Open Play Store
        window.open('https://play.google.com/store/apps/details?id=com.registbar.app', '_system');
    };

    if (!showUpdateModal) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl max-w-sm w-full p-8 shadow-2xl animate-fade-in-up">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                    <div className="p-5 bg-primary/10 rounded-full">
                        <Icon name="system_update_alt" size={48} className="text-primary" />
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-extrabold text-slate-900 text-center mb-3">
                    {isForced ? '¡Actualización Requerida!' : 'Nueva Actualización'}
                </h2>

                {/* Message */}
                <p className="text-slate-600 text-center mb-6 text-sm leading-relaxed">
                    {updateMessage}
                </p>

                {/* Update Button */}
                <button
                    onClick={handleUpdate}
                    className="w-full bg-primary text-white font-extrabold py-4 rounded-2xl shadow-neon hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 mb-3"
                >
                    Actualizar Ahora
                    <Icon name="arrow_forward" size={20} />
                </button>

                {/* Skip button (only if not forced) */}
                {!isForced && (
                    <button
                        onClick={() => setShowUpdateModal(false)}
                        className="w-full text-slate-500 text-sm font-medium hover:text-slate-700 transition-colors"
                    >
                        Recordarme después
                    </button>
                )}
            </div>
        </div>
    );
};
