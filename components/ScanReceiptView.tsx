import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icons';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { SubscriptionPaywall } from './SubscriptionPaywall';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

interface ScanReceiptViewProps {
    onClose: () => void;
}

export const ScanReceiptView: React.FC<ScanReceiptViewProps> = ({ onClose }) => {
    // 1. ALL HOOKS MUST BE DECLARED FIRST (RULES OF HOOKS)
    const { user } = useAuth();
    const { showToast } = useToast();

    // UI & Logic Hooks
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 2. EFFECTS
    useEffect(() => {
        const checkSub = async () => {
            console.log("Checking subscription for user:", user?.id);
            if (!user) {
                console.log("No user, defaulting to free");
                setSubscriptionStatus('free');
                return;
            }
            try {
                const { data, error } = await supabase.from('profiles').select('subscription_status').eq('id', user.id).single();
                if (error) {
                    console.error("Error fetching subscription:", error);
                    setSubscriptionStatus('free');
                } else {
                    console.log("Subscription status:", data?.subscription_status);
                    setSubscriptionStatus(data?.subscription_status || 'free');
                }
            } catch (e) {
                console.error("Exception checking subscription:", e);
                setSubscriptionStatus('free');
            }
        };
        checkSub();
    }, [user]);

    useEffect(() => {
        if (capturedImage) {
            analyzeReceipt(capturedImage);
        }
    }, [capturedImage]);

    // 3. HELPER FUNCTIONS & LOGIC
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
                            if (blob) resolve(blob);
                            else resolve(dataURItoBlob(dataURI));
                        },
                        'image/jpeg',
                        quality
                    );
                } else {
                    resolve(dataURItoBlob(dataURI));
                }
            };
            img.onerror = (err) => {
                console.error("Image load error:", err);
                resolve(dataURItoBlob(dataURI));
            };
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
            console.error("Blob conversion error:", e);
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

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Error del servidor: ${response.status} ${text}`);
            }

            const data = await response.json();

            if (data) {
                if (data.monto_total) setAmount(Number(data.monto_total));
                if (data.nombre_comercio) setMerchant(data.nombre_comercio);
                if (data.rut_emisor) setRut(data.rut_emisor);
                if (data.fecha_gasto) setDate(data.fecha_gasto);

                showToast('¡Datos extraídos con éxito!', 'success');
            }

        } catch (error: any) {
            console.error("Full Error:", error);
            let errorMessage = 'No se pudo analizar el voucher.';
            if (error instanceof TypeError && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
                errorMessage += ' Error de Conexión/CORS.';
            } else {
                errorMessage += ` Detalle: ${error?.message || error}`;
            }
            showToast(errorMessage, 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const takePhoto = async () => {
        if (isAnalyzing) return;

        const isWeb = Capacitor.getPlatform() === 'web';
        console.log("Tomando foto. Plataforma:", Capacitor.getPlatform());

        if (isWeb) {
            // WEB FALLBACK: Trigger hidden file input directly to avoid PWA Elements crash
            console.log("Modo Web: Abriendo selector de archivos...");
            if (fileInputRef.current) {
                fileInputRef.current.click();
            }
            return;
        }

        try {
            console.log("Opening Native Camera...");
            const image = await Camera.getPhoto({
                quality: 80,
                allowEditing: false,
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Camera,
                width: 1280
            });

            console.log("Photo taken");
            if (image.dataUrl) {
                setCapturedImage(image.dataUrl);
            }
        } catch (error) {
            console.log("Camera handling error or user cancelled:", error);
        }
    };

    const retakePhoto = () => {
        setCapturedImage(null);
        setAmount('');
        setMerchant('');
        setRut('');
        setDate('');
        setIsAnalyzing(false);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCapturedImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerFilePicker = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleSave = async () => {
        if (!user || !amount) return;
        setIsSaving(true);

        try {
            let receiptUrl = null;

            if (capturedImage) {
                const blob = await resizeAndCompressImage(capturedImage, 1024, 0.7);
                const fileExt = 'jpg';
                const fileName = `${Date.now()}_receipt.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('receipts')
                    .upload(filePath, blob, {
                        contentType: 'image/jpeg',
                        upsert: false
                    });

                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('receipts')
                        .getPublicUrl(filePath);
                    receiptUrl = publicUrl;
                }
            }

            const finalAmount = transactionType === 'expense'
                ? -Math.abs(Number(amount))
                : Math.abs(Number(amount));

            const categoryObj = currentCategories.find(c => c.label === selectedCategory);
            const finalCategory = categoryObj ? categoryObj.value : 'other';

            const { error } = await supabase.from('transactions').insert({
                user_id: user.id,
                title: merchant || (transactionType === 'expense' ? 'Gasto Escaneado' : 'Ingreso Escaneado'),
                amount: finalAmount,
                type: transactionType,
                category: finalCategory,
                date: date ? new Date(date).toISOString() : new Date().toISOString(),
                receipt_url: receiptUrl
            });

            if (error) throw error;

            showToast(`${transactionType === 'expense' ? 'Gasto' : 'Ingreso'} registrado correctamente`, 'success');
            onClose();
            window.location.reload();
        } catch (error) {
            console.error('Error saving:', error);
            showToast('Error al guardar', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // 4. CONDITIONAL RENDERING (ONLY AFTER ALL HOOKS ARE DECLARED)
    if (subscriptionStatus === null) {
        return <div className="fixed inset-0 bg-black z-50 flex items-center justify-center"><Icon name="refresh" className="animate-spin text-white" /></div>;
    }

    if (subscriptionStatus !== 'pro') {
        return <SubscriptionPaywall onClose={onClose} />;
    }

    // Replaced motion.div with standard div to prevent crashes
    return (
        <div
            className="fixed inset-0 z-50 bg-black flex flex-col"
        >
            {/* Top Camera/Image Area */}
            <div className="relative h-[40%] w-full bg-slate-900 overflow-hidden flex flex-col">
                <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-20">
                    <button onClick={onClose} className="size-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-colors">
                        <Icon name="arrow_back" size={24} />
                    </button>
                    <span className="text-white font-bold text-lg shadow-sm">Escanear Factura</span>
                    <div className="size-10" />
                </div>

                <div className="relative flex-1 flex items-center justify-center bg-black">
                    {!capturedImage && (
                        <div className="flex flex-col items-center justify-center text-slate-500 gap-4 cursor-pointer" onClick={takePhoto}>
                            <div className="size-16 rounded-full bg-slate-800 flex items-center justify-center animate-pulse">
                                <Icon name="photo_camera" size={32} className="text-slate-400" />
                            </div>
                            <p className="text-sm font-medium opacity-70">Toca para abrir cámara</p>
                        </div>
                    )}

                    {capturedImage && (
                        <img
                            src={capturedImage}
                            alt="Captured"
                            className="absolute inset-0 w-full h-full object-contain bg-black"
                        />
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />

                    {capturedImage && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                            <button onClick={retakePhoto} className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-white font-medium border border-white/10 flex items-center gap-2 hover:bg-black/80 transition-colors">
                                <Icon name="replay" size={18} /> Reintentar
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Controls */}
            {!capturedImage && (
                <div className="absolute bottom-10 left-0 right-0 px-8 flex justify-between items-center z-50 pointer-events-none">
                    <button
                        onClick={triggerFilePicker}
                        className="pointer-events-auto size-14 rounded-full bg-slate-900/40 backdrop-blur-xl flex items-center justify-center text-white border border-white/10 shadow-lg active:scale-95 transition-all"
                    >
                        <Icon name="collections" size={24} />
                    </button>

                    <button
                        onClick={takePhoto}
                        className="pointer-events-auto size-24 rounded-full border-4 border-white/20 bg-emerald-500/10 backdrop-blur-md flex items-center justify-center active:scale-95 transition-all shadow-2xl animate-pulse"
                    >
                        <div className="size-20 bg-white rounded-full border-[3px] border-slate-900 flex items-center justify-center shadow-inner">
                            <Icon name="camera_alt" size={32} className="text-slate-900" />
                        </div>
                    </button>

                    <div className="size-14"></div>
                </div>
            )}

            {/* Bottom Form */}
            <div className="flex-1 bg-slate-50 rounded-t-3xl -mt-6 z-30 p-5 flex flex-col gap-4 overflow-y-auto relative border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
                <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-1"></div>

                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900">Detalles</h2>
                    {isAnalyzing ? (
                        <div className="bg-primary/10 flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 animate-pulse">
                            <Icon name="auto_awesome" size={16} className="text-primary" />
                            <span className="text-xs font-bold text-primary uppercase tracking-wide">Analizando IA...</span>
                        </div>
                    ) : (
                        <div className="bg-slate-100 flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200">
                            <Icon name="verified" size={14} className="text-slate-400" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Revise los datos</span>
                        </div>
                    )}
                </div>

                <div className="flex bg-slate-200 p-1 rounded-xl">
                    <button
                        onClick={() => setTransactionType('expense')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${transactionType === 'expense' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Gasto
                    </button>
                    <button
                        onClick={() => setTransactionType('income')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${transactionType === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Ingreso
                    </button>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Monto Total</label>
                    <div className="flex justify-between items-center bg-white w-full p-4 rounded-2xl border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                        <span className={`font-bold text-xl ${transactionType === 'expense' ? 'text-slate-400' : 'text-emerald-500'}`}>$</span>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(Number(e.target.value))}
                            placeholder="0"
                            className="text-3xl font-bold text-slate-900 tracking-tight bg-transparent border-none outline-none w-full ml-2 placeholder:text-slate-300"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Comercio / Entidad</label>
                        <input
                            type="text"
                            value={merchant}
                            onChange={(e) => setMerchant(e.target.value)}
                            placeholder={transactionType === 'expense' ? "Ej: Sodimac, Lider..." : "Ej: Cliente, Transbank..."}
                            className="bg-white h-12 rounded-xl px-4 font-bold text-slate-900 border border-slate-200 focus:outline-none focus:border-primary/50 shadow-sm"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">RUT / ID</label>
                            <input
                                type="text"
                                value={rut}
                                onChange={(e) => setRut(e.target.value)}
                                placeholder="XX.XXX.XXX-K"
                                className="bg-white h-12 rounded-xl px-4 font-mono font-medium text-slate-900 border border-slate-200 focus:outline-none focus:border-primary/50 shadow-sm"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Fecha</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="bg-white h-12 rounded-xl px-4 font-medium text-slate-900 border border-slate-200 focus:outline-none focus:border-primary/50 shadow-sm"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Categoría</label>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                        {currentCategories.map(cat => (
                            <button
                                key={cat.label}
                                onClick={() => setSelectedCategory(cat.label)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors whitespace-nowrap ${selectedCategory === cat.label
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    disabled={isSaving || !amount}
                    className={`w-full text-white font-bold text-lg py-4 rounded-xl shadow-lg mt-auto hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100 ${transactionType === 'expense' ? 'bg-slate-900' : 'bg-emerald-600'}`}
                >
                    {isSaving ? 'Guardando...' : (transactionType === 'expense' ? 'Confirmar Gasto' : 'Confirmar Ingreso')}
                    {!isSaving && <Icon name="check" size={24} />}
                </button>
            </div>
        </div>
    );
};
