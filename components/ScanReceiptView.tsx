import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { SubscriptionPaywall } from './SubscriptionPaywall';

// NOTE: completely removed @capacitor/camera imports to ensure web stability
// We will use standard HTML5 Media Capture for native-like behavior on mobile web

interface ScanReceiptViewProps {
    onClose: () => void;
}

export const ScanReceiptView: React.FC<ScanReceiptViewProps> = ({ onClose }) => {
    // 1. Hook Declarations
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
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    // Ref for the standard HTML file input
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 2. Subscription Check
    useEffect(() => {
        const checkSub = async () => {
            if (!user) {
                setSubscriptionStatus('free');
                return;
            }
            try {
                // Use maybeSingle to prevent error if row missing
                const { data, error } = await supabase
                    .from('profiles')
                    .select('subscription_status')
                    .eq('id', user.id)
                    .maybeSingle();

                if (error) {
                    console.error("Error fetching subscription:", error);
                    setSubscriptionStatus('free');
                } else {
                    setSubscriptionStatus(data?.subscription_status || 'free');
                }
            } catch (e) {
                console.error("Exception checking subscription:", e);
                setSubscriptionStatus('free');
            }
        };
        checkSub();
    }, [user]);

    // 3. Auto-analyze when image changes
    useEffect(() => {
        if (capturedImage) {
            analyzeReceipt(capturedImage);
        }
    }, [capturedImage]);

    // 4. Helper Functions
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

    const resizeAndCompressImage = (dataURI: string, maxWidth = 1024, quality = 0.6): Promise<Blob> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = dataURI;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob(
                        (blob) => {
                            resolve(blob || dataURItoBlob(dataURI));
                        },
                        'image/jpeg',
                        quality
                    );
                } else {
                    resolve(dataURItoBlob(dataURI));
                }
            };
            img.onerror = () => resolve(dataURItoBlob(dataURI));
        });
    };

    const dataURItoBlob = (dataURI: string) => {
        try {
            const split = dataURI.split(',');
            if (split.length < 2) return new Blob([]);
            const byteString = atob(split[1]);
            const mimeString = split[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            return new Blob([ab], { type: mimeString });
        } catch (e) {
            return new Blob([]);
        }
    };

    const analyzeReceipt = async (base64Image: string) => {
        setIsAnalyzing(true);
        try {
            const blob = await resizeAndCompressImage(base64Image, 1024, 0.6);
            const formData = new FormData();
            formData.append('file', blob, 'receipt.jpg');

            const response = await fetch('https://n8n.efinnovation.cl/webhook/scan-receipt-v2', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Error al conectar con el servidor de análisis');

            const data = await response.json();
            if (data) {
                if (data.monto_total) setAmount(Number(data.monto_total));
                if (data.nombre_comercio) setMerchant(data.nombre_comercio);
                if (data.rut_emisor) setRut(data.rut_emisor);
                if (data.fecha_gasto) setDate(data.fecha_gasto);
                showToast('¡Datos extraídos con éxito!', 'success');
            }
        } catch (error) {
            console.error("Analysis error:", error);
            showToast('No se pudo analizar el comprobante automáticamente', 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCapturedImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerNativeCamera = () => {
        // Trigger the hidden file input
        fileInputRef.current?.click();
    };

    const retakePhoto = () => {
        setCapturedImage(null);
        setAmount('');
        setIsAnalyzing(false);
        // Reset file input so checking the same file again triggers onChange
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSave = async () => {
        if (!user || !amount) return;
        setIsSaving(true);
        try {
            let receiptUrl = null;
            if (capturedImage) {
                const blob = await resizeAndCompressImage(capturedImage, 1024, 0.7);
                const fileName = `${Date.now()}_receipt.jpg`;
                const filePath = `${user.id}/${fileName}`;

                const { error: upError } = await supabase.storage
                    .from('receipts')
                    .upload(filePath, blob, { contentType: 'image/jpeg' });

                if (!upError) {
                    const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
                    receiptUrl = data.publicUrl;
                }
            }

            const finalAmount = transactionType === 'expense' ? -Math.abs(Number(amount)) : Math.abs(Number(amount));
            const categoryObj = currentCategories.find(c => c.label === selectedCategory);
            const finalCategory = categoryObj ? categoryObj.value : 'other';

            // MANUAL DATE FIX: Create date in user's local timezone to prevent UTC shift
            const getLocalDateISO = () => {
                if (!date) return new Date().toISOString();

                const now = new Date(); // Current local time
                const [y, m, d] = date.split('-').map(Number);
                // Create a new date using the user's selected YMD and their current HMS
                // This 'localDate' is fully grounded in the device's timezone
                const localDate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
                return localDate.toISOString();
            };

            const { error } = await supabase.from('transactions').insert({
                user_id: user.id,
                title: merchant || (transactionType === 'expense' ? 'Gasto Escaneado' : 'Ingreso Escaneado'),
                amount: finalAmount,
                type: transactionType,
                category: finalCategory,
                date: getLocalDateISO(),
                receipt_url: receiptUrl
            });

            if (error) throw error;
            showToast('Guardado correctamente', 'success');
            onClose();
            window.location.reload();

        } catch (e) {
            console.error(e);
            showToast('Error al guardar', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // 5. Render - Fail safe
    if (subscriptionStatus === null) {
        return (
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
        );
    }

    if (subscriptionStatus !== 'pro') {
        return <SubscriptionPaywall onClose={onClose} />;
    }

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col h-full w-full">

            {/* --- HEADER --- */}
            <div className="relative h-16 w-full bg-slate-900 border-b border-white/10 flex items-center justify-between px-4 z-20 shrink-0">
                <button onClick={onClose} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20">
                    <Icon name="arrow_back" size={24} />
                </button>
                <span className="text-white font-bold text-lg">Escanear</span>
                <div className="w-10"></div>
            </div>

            {/* --- MAIN CAMERA AREA --- */}
            <div className="flex-1 relative bg-black flex flex-col items-center justify-center overflow-hidden shrink-0 min-h-[300px]">

                {/* 1. STATE: NO IMAGE */}
                {!capturedImage && (
                    <div
                        onClick={triggerNativeCamera}
                        className="flex flex-col items-center gap-4 cursor-pointer p-8 rounded-2xl active:bg-white/5 transition-colors"
                    >
                        <div className="size-20 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center shadow-2xl">
                            <Icon name="photo_camera" size={36} className="text-emerald-400" />
                        </div>
                        <p className="text-slate-400 font-medium">Toca para tomar foto</p>
                    </div>
                )}

                {/* 2. STATE: IMAGE PREVIEW */}
                {capturedImage && (
                    <div className="relative w-full h-full">
                        <img
                            src={capturedImage}
                            alt="Receipt"
                            className="w-full h-full object-contain bg-black"
                        />
                        <button
                            onClick={retakePhoto}
                            className="absolute bottom-4 right-4 bg-black/60 text-white px-4 py-2 rounded-full backdrop-blur-md border border-white/20 flex items-center gap-2"
                        >
                            <Icon name="replay" size={18} /> Reintentar
                        </button>
                    </div>
                )}

                {/* HIDDEN INPUT FOR NATIVE CAMERA */}
                {/* accept="image/*" + capture="environment" forces rear camera on mobile */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileSelect}
                />
            </div>

            {/* --- FORM SECTION (Scrollable) --- */}
            <div className="flex-1 bg-slate-50 w-full rounded-t-3xl -mt-4 z-30 flex flex-col overflow-hidden max-h-[50%]">
                <div className="w-full h-full overflow-y-auto p-5 pb-20"> {/* pb-20 for safe area */}

                    <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mb-6 shrink-0" />

                    <div className="space-y-5">

                        {/* ANALYSIS STATUS */}
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-slate-900 text-lg">Detalles del Comprobante</h3>
                            {isAnalyzing && (
                                <span className="text-xs font-bold text-primary animate-pulse bg-primary/10 px-2 py-1 rounded-full">
                                    Analizando IA...
                                </span>
                            )}
                        </div>

                        {/* TYPE TOGGLE */}
                        <div className="flex bg-slate-200 p-1 rounded-xl">
                            <button onClick={() => setTransactionType('expense')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${transactionType === 'expense' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>Gasto</button>
                            <button onClick={() => setTransactionType('income')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${transactionType === 'income' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>Ingreso</button>
                        </div>

                        {/* AMOUNT INPUT */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Monto Total</label>
                            <div className="mt-1 flex items-center bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm focus-within:ring-2 ring-primary/20">
                                <span className="text-slate-400 font-bold text-lg">$</span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(Number(e.target.value))}
                                    placeholder="0"
                                    className="w-full ml-2 text-2xl font-bold bg-transparent outline-none text-slate-900 placeholder:text-slate-300"
                                />
                            </div>
                        </div>

                        {/* MERCHANT */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Comercio / Detalle</label>
                            <input
                                type="text"
                                value={merchant}
                                onChange={e => setMerchant(e.target.value)}
                                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 outline-none focus:ring-2 ring-primary/20"
                                placeholder={transactionType === 'expense' ? "Ej: Supermercado" : "Ej: Servicio Cliente"}
                            />
                        </div>

                        {/* DATE */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Fecha</label>
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-900 outline-none"
                            />
                        </div>

                        {/* CATEGORIES */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-2 block">Categoría</label>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                {currentCategories.map(cat => (
                                    <button
                                        key={cat.label}
                                        onClick={() => setSelectedCategory(cat.label)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold border whitespace-nowrap ${selectedCategory === cat.label ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'}`}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="h-4"></div>

                        {/* SAVE BUTTON */}
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !amount}
                            className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 ${transactionType === 'expense' ? 'bg-slate-900' : 'bg-emerald-600'} ${(!amount || isSaving) ? 'opacity-50' : ''}`}
                        >
                            {isSaving ? 'Guardando...' : 'Confirmar'}
                            {!isSaving && <Icon name="check" size={24} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
