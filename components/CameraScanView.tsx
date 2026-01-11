import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { SubscriptionPaywall } from './SubscriptionPaywall';

// NEW LOGIC: Pure HTML5 Camera Capture
// This component is designed to be the "New Camera Logic" requested.
// It bypasses all complex plugins and uses simple, robust HTML input.

interface CameraScanViewProps {
    onClose: () => void;
}

export const CameraScanView: React.FC<CameraScanViewProps> = ({ onClose }) => {
    // Hooks
    const { user } = useAuth();
    const { showToast } = useToast();

    // State
    const [subscriptionStatus, setSubscriptionStatus] = useState<'free' | 'pro' | null>(null);
    const [amount, setAmount] = useState<number | string>('');
    const [merchant, setMerchant] = useState('');
    const [rut, setRut] = useState('');
    const [date, setDate] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('Insumos');
    const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');

    // Image Data
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Ref for file input
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Categories
    const expenseCategories = [
        { label: 'Insumos', value: 'supply' },
        { label: 'Equipamiento', value: 'supply' },
        { label: 'Arriendo', value: 'other' },
        { label: 'Servicios', value: 'other' },
        { label: 'Otros', value: 'other' }
    ];

    const incomeCategories = [
        { label: 'Servicio', value: 'service' },
        { label: 'Propina', value: 'tip' },
        { label: 'Otro', value: 'other' }
    ];

    const currentCategories = transactionType === 'expense' ? expenseCategories : incomeCategories;

    // 1. Check Subscription
    useEffect(() => {
        const checkSub = async () => {
            if (!user) {
                setSubscriptionStatus('free');
                return;
            }
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('subscription_status')
                    .eq('id', user.id)
                    .maybeSingle();

                if (error || !data) {
                    setSubscriptionStatus('free');
                } else {
                    setSubscriptionStatus(data.subscription_status || 'free');
                }
            } catch (e) {
                setSubscriptionStatus('free');
            }
        };
        checkSub();
    }, [user]);

    // 2. Analyze Image When Selected
    useEffect(() => {
        if (previewUrl) {
            analyzeReceipt(previewUrl);
        }
    }, [previewUrl]);

    // Helper: Resize Image
    const resizeImage = (dataUrl: string): Promise<Blob> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = dataUrl;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1080;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        resolve(blob!);
                    }, 'image/jpeg', 0.7);
                } else {
                    resolve(dataURItoBlob(dataUrl));
                }
            };
        });
    };

    const dataURItoBlob = (dataURI: string) => {
        try {
            const split = dataURI.split(',');
            const byteString = atob(split[1]);
            const mimeString = split[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            return new Blob([ab], { type: mimeString });
        } catch {
            return new Blob([]);
        }
    };

    const analyzeReceipt = async (imgUrl: string) => {
        setIsAnalyzing(true);
        try {
            const blob = await resizeImage(imgUrl);
            const formData = new FormData();
            formData.append('file', blob, 'receipt.jpg');

            const response = await fetch('https://n8n.efinnovation.cl/webhook/scan-receipt-v2', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                if (data.monto_total) setAmount(Number(data.monto_total));
                if (data.nombre_comercio) setMerchant(data.nombre_comercio);
                if (data.rut_emisor) setRut(data.rut_emisor);
                if (data.fecha_gasto) setDate(data.fecha_gasto);
                showToast('Datos detectados', 'success');
            }
        } catch (e) {
            console.warn("Analysis failed", e);
            showToast('No se pudieron detectar datos automáticos', 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Handlers
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => setPreviewUrl(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const openCamera = () => {
        fileInputRef.current?.click();
    };

    const handleSave = async () => {
        if (!user || !amount) return;
        setIsSaving(true);
        try {
            let receiptUrl = null;
            if (previewUrl) {
                const blob = await resizeImage(previewUrl);
                const path = `${user.id}/${Date.now()}_cam.jpg`;
                const { error: upErr } = await supabase.storage.from('receipts').upload(path, blob);
                if (!upErr) {
                    const { data } = supabase.storage.from('receipts').getPublicUrl(path);
                    receiptUrl = data.publicUrl;
                }
            }

            const finalAmount = transactionType === 'expense' ? -Math.abs(Number(amount)) : Math.abs(Number(amount));
            const catVal = currentCategories.find(c => c.label === selectedCategory)?.value || 'other';

            const { error } = await supabase.from('transactions').insert({
                user_id: user.id,
                title: merchant || 'Scanner Camera',
                amount: finalAmount,
                type: transactionType,
                category: catVal,
                date: date ? new Date(date).toISOString() : new Date().toISOString(),
                receipt_url: receiptUrl
            });

            if (error) throw error;
            showToast('Guardado correctamente', 'success');
            onClose();
            // Optional: force refresh
            window.location.reload();
        } catch (e) {
            console.error(e);
            showToast('Error al guardar', 'error');
        } finally {
            setIsSaving(false);
        }
    };


    // Render
    if (subscriptionStatus === null) {
        return <div className="fixed inset-0 z-50 bg-black flex items-center justify-center text-white">Cargando...</div>;
    }
    if (subscriptionStatus !== 'pro') {
        return <SubscriptionPaywall onClose={onClose} />;
    }

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col h-full w-full animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-gray-800 z-20">
                <button onClick={onClose} className="p-2 rounded-full bg-gray-800 text-white"><Icon name="arrow_back" size={24} /></button>
                <h2 className="text-white font-bold">Cámara Scanner</h2>
                <div className="w-10"></div>
            </div>

            {/* Camera / Preview Area */}
            <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
                {!previewUrl && (
                    <div onClick={openCamera} className="cursor-pointer text-center p-6 rounded-2xl bg-gray-900 border border-gray-700 hover:bg-gray-800 transition-colors">
                        <div className="size-20 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-900/50 animate-pulse">
                            <Icon name="photo_camera" size={40} className="text-white" />
                        </div>
                        <p className="text-gray-300 font-medium text-lg">Tocar para Foto</p>
                        <p className="text-gray-500 text-sm mt-1">Usa la cámara nativa</p>
                    </div>
                )}
                {previewUrl && (
                    <div className="relative w-full h-full flex items-center justify-center bg-black">
                        <img src={previewUrl} className="max-w-full max-h-full object-contain" alt="Preview" />
                        <button onClick={() => setPreviewUrl(null)} className="absolute bottom-5 right-5 bg-black/70 text-white px-4 py-2 rounded-full border border-gray-600 flex items-center gap-2">
                            <Icon name="replay" size={20} /> Reintentar
                        </button>
                    </div>
                )}

                {/* Hidden Input: capture="environment" forces rear camera on mobile */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </div>

            {/* Form Area */}
            <div className="bg-slate-50 rounded-t-2xl p-6 min-h-[40%] flex flex-col gap-4 overflow-y-auto">
                <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-2" />

                {/* Loading Indicator */}
                {isAnalyzing && (
                    <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold border border-blue-100 mb-2">
                        <div className="animate-spin size-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                        Analizando imagen con IA...
                    </div>
                )}

                {/* Amount Row */}
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Monto</label>
                        <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-3 mt-1 shadow-sm focus-within:ring-2 ring-emerald-500/20">
                            <span className="text-gray-400 font-bold">$</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={e => setAmount(Number(e.target.value))}
                                className="w-full ml-2 text-xl font-bold outline-none bg-transparent"
                                placeholder="0"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Tipo</label>
                        <div className="flex bg-gray-200 rounded-xl p-1 mt-1">
                            <button onClick={() => setTransactionType('expense')} className={`px-3 py-2.5 rounded-lg text-sm font-bold ${transactionType === 'expense' ? 'bg-white shadow text-black' : 'text-gray-500'}`}>Gasto</button>
                            <button onClick={() => setTransactionType('income')} className={`px-3 py-2.5 rounded-lg text-sm font-bold ${transactionType === 'income' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}>Ingreso</button>
                        </div>
                    </div>
                </div>

                {/* Date & Merchant */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Comercio</label>
                        <input
                            type="text"
                            value={merchant}
                            onChange={e => setMerchant(e.target.value)}
                            className="w-full mt-1 bg-white border border-gray-200 rounded-xl px-3 py-3 font-semibold outline-none focus:border-emerald-500"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Fecha</label>
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="w-full mt-1 bg-white border border-gray-200 rounded-xl px-3 py-3 font-medium outline-none"
                        />
                    </div>
                </div>

                {/* Action Button */}
                <button
                    onClick={handleSave}
                    disabled={isSaving || !amount}
                    className="mt-2 w-full bg-slate-900 text-white font-bold text-lg py-4 rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                >
                    {isSaving ? 'Guardando...' : 'Confirmar Operación'}
                </button>
            </div>
        </div>
    );
};
