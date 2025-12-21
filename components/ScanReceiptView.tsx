import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';

interface ScanReceiptViewProps {
    onClose: () => void;
}

export const ScanReceiptView: React.FC<ScanReceiptViewProps> = ({ onClose }) => {
    const { user } = useAuth();
    const { showToast } = useToast();

    // Data Strings
    const [amount, setAmount] = useState<number | string>('');
    const [merchant, setMerchant] = useState('');
    const [rut, setRut] = useState('');
    const [date, setDate] = useState('');

    // UI State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('Insumos');
    const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');

    // Categorías
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

    // Camera State
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState<boolean>(true);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize Camera
    useEffect(() => {
        startCamera();
        return () => {
            stopCamera();
        };
    }, []);

    // Auto-analyze when image is captured
    useEffect(() => {
        if (capturedImage) {
            analyzeReceipt(capturedImage);
        }
    }, [capturedImage]);

    const startCamera = async () => {
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    }
                });

                // Attempt to enable autofocus
                const track = stream.getVideoTracks()[0];
                const capabilities = track.getCapabilities ? track.getCapabilities() : {};
                // @ts-ignore - focusMode types might be missing in standard lib
                if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
                    try {
                        // @ts-ignore
                        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
                    } catch (e) {
                        console.log('Autofocus not supported/failed');
                    }
                }

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    setHasPermission(true);
                    setIsCameraActive(true);
                }
            } else {
                console.error("Camera not supported");
                setHasPermission(false);
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            setHasPermission(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setIsCameraActive(false);
        }
    };

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageDataUrl = canvas.toDataURL('image/jpeg');
                setCapturedImage(imageDataUrl);
                stopCamera();
            }
        }
    };

    const retakePhoto = () => {
        setCapturedImage(null);
        setAmount('');
        setMerchant('');
        setRut('');
        setDate('');
        setIsAnalyzing(false);
        startCamera();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCapturedImage(reader.result as string);
                stopCamera();
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerFilePicker = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    // --- AI ANALYSIS ---
    // Helper to resize and compress image
    const resizeAndCompressImage = (dataURI: string, maxWidth = 1024, quality = 0.6): Promise<Blob> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = dataURI;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
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
                            else resolve(dataURItoBlob(dataURI)); // Fallback
                        },
                        'image/jpeg',
                        quality
                    );
                } else {
                    resolve(dataURItoBlob(dataURI)); // Fallback
                }
            };
        });
    };

    // Helper to convert Base64 to Blob safely (Backup)
    const dataURItoBlob = (dataURI: string) => {
        const byteString = atob(dataURI.split(',')[1]);
        const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], { type: mimeString });
    };

    // --- AI ANALYSIS ---
    const analyzeReceipt = async (base64Image: string) => {
        setIsAnalyzing(true);
        try {
            console.log("Iniciando optimización de imagen...");

            // Compress image to max 1024px width and 60% quality
            const blob = await resizeAndCompressImage(base64Image, 1024, 0.6);

            console.log(`Blob optimizado. Tamaño: ${(blob.size / 1024).toFixed(2)} KB`);

            const formData = new FormData();
            formData.append('file', blob, 'receipt.jpg');


            console.log("Enviando a n8n...");
            // Call n8n Webhook
            const response = await fetch('https://n8n.efinnovation.cl/webhook/scan-receipt-v2', {
                method: 'POST',
                body: formData
            });

            console.log("Respuesta n8n status:", response.status);

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Error del servidor: ${response.status} ${text}`);
            }

            const data = await response.json();
            console.log("Datos recibidos:", data);

            // Populate fields if data exists
            if (data) {
                if (data.monto_total) setAmount(Number(data.monto_total));
                if (data.nombre_comercio) setMerchant(data.nombre_comercio);
                if (data.rut_emisor) setRut(data.rut_emisor);
                if (data.fecha_gasto) setDate(data.fecha_gasto); // Ensure n8n returns YYYY-MM-DD

                showToast('¡Datos extraídos con éxito!', 'success');
            }

        } catch (error: any) {
            console.error("Full Error:", error);

            let errorMessage = 'No se pudo analizar el voucher.';

            if (error instanceof TypeError && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
                errorMessage += ' Error de Conexión/CORS. Verifique si n8n está activo y accesible.';
            } else {
                errorMessage += ` Detalle: ${error?.message || error}`;
            }

            showToast(errorMessage, 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // --- SAVE TO SUPABASE ---
    const handleSave = async () => {
        if (!user || !amount) return;
        setIsSaving(true);

        try {
            let receiptUrl = null;

            // 1. Upload Image to Supabase Storage
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

                if (uploadError) {
                    console.error('Error uploading image:', uploadError);
                    // We continue saving the transaction even if image fails, but warn user?
                    // For now, let's just log it.
                } else {
                    // Get Public URL
                    const { data: { publicUrl } } = supabase.storage
                        .from('receipts')
                        .getPublicUrl(filePath);

                    receiptUrl = publicUrl;
                }
            }

            // 2. Prepare Transaction Data
            // Expenses are negative, Incomes are positive
            const finalAmount = transactionType === 'expense'
                ? -Math.abs(Number(amount))
                : Math.abs(Number(amount));

            // Find db category value based on selected UI category label
            const categoryObj = currentCategories.find(c => c.label === selectedCategory);
            const finalCategory = categoryObj ? categoryObj.value : 'other';

            // 3. Insert into DB
            const { error } = await supabase.from('transactions').insert({
                user_id: user.id,
                title: merchant || (transactionType === 'expense' ? 'Gasto Escaneado' : 'Ingreso Escaneado'),
                amount: finalAmount,
                type: transactionType,
                category: finalCategory,
                date: date ? new Date(date).toISOString() : new Date().toISOString(),
                receipt_url: receiptUrl // Save the URL!
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

    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 300, mass: 0.8 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
        >
            {/* Top Camera Area */}
            <div className="relative h-[40%] w-full bg-slate-900 overflow-hidden flex flex-col">
                <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-20">
                    <button onClick={onClose} className="size-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-colors">
                        <Icon name="arrow_back" size={24} />
                    </button>
                    <span className="text-white font-bold text-lg shadow-sm">Escanear Factura</span>
                    <button className="size-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-colors">
                        <Icon name="flash_on" size={24} />
                    </button>
                </div>

                <div className="relative flex-1 flex items-center justify-center bg-black">
                    {!capturedImage && (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="absolute inset-0 w-full h-full object-cover opacity-90"
                        />
                    )}
                    {capturedImage && (
                        <img
                            src={capturedImage}
                            alt="Captured"
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    )}
                    <canvas ref={canvasRef} className="hidden" />
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleFileChange}
                    />

                    {/* Scanning Overlay */}
                    {!capturedImage && isCameraActive && (
                        <div className="absolute w-64 h-80 border-2 border-primary/50 rounded-3xl flex flex-col justify-between p-4 z-10 pointer-events-none">
                            <div className="flex justify-between">
                                <div className="size-6 border-t-4 border-l-4 border-primary rounded-tl-xl shadow-[0_0_15px_rgba(25,230,107,0.5)]"></div>
                                <div className="size-6 border-t-4 border-r-4 border-primary rounded-tr-xl shadow-[0_0_15px_rgba(25,230,107,0.5)]"></div>
                            </div>
                            <div className="absolute top-10 left-4 right-4 h-0.5 bg-primary shadow-[0_0_20px_rgba(25,230,107,0.8)] animate-[scan_2s_infinite]"></div>
                            <div className="flex justify-between mt-auto">
                                <div className="size-6 border-b-4 border-l-4 border-primary rounded-bl-xl shadow-[0_0_15px_rgba(25,230,107,0.5)]"></div>
                                <div className="size-6 border-b-4 border-r-4 border-primary rounded-br-xl shadow-[0_0_15px_rgba(25,230,107,0.5)]"></div>
                            </div>
                        </div>
                    )}



                    {/* Retake */}
                    {capturedImage && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                            <button onClick={retakePhoto} className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-white font-medium border border-white/10 flex items-center gap-2 hover:bg-black/80 transition-colors">
                                <Icon name="replay" size={18} /> Reintentar
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Controls (Moved to bottom for ergonomics) */}
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
                        className="pointer-events-auto size-24 rounded-full border-4 border-white/20 bg-white/10 backdrop-blur-md flex items-center justify-center active:scale-95 transition-all shadow-2xl"
                    >
                        <div className="size-20 bg-white rounded-full border-[3px] border-slate-900 flex items-center justify-center shadow-inner">
                            <Icon name="camera_alt" size={32} className="text-slate-900 opacity-80" />
                        </div>
                    </button>

                    <div className="size-14"></div> {/* Spacer for balance */}
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

                {/* Transaction Type Toggle */}
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

                {/* Amount */}
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

                {/* Merchant & RUT Grid */}
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

                {/* Category Selection */}
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

                {/* Action Button */}
                <button
                    onClick={handleSave}
                    disabled={isSaving || !amount}
                    className={`w-full text-white font-bold text-lg py-4 rounded-xl shadow-lg mt-auto hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100 ${transactionType === 'expense' ? 'bg-slate-900' : 'bg-emerald-600'}`}
                >
                    {isSaving ? 'Guardando...' : (transactionType === 'expense' ? 'Confirmar Gasto' : 'Confirmar Ingreso')}
                    {!isSaving && <Icon name="check" size={24} />}
                </button>
            </div>

            <style>{`
                @keyframes scan {
                    0% { top: 10%; opacity: 0; }
                    5% { opacity: 1; }
                    95% { opacity: 1; }
                    100% { top: 90%; opacity: 0; }
                }
            `}</style>
        </motion.div>
    );
};
