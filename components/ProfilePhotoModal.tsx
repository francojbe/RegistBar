import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Cropper from 'react-easy-crop';
import heic2any from 'heic2any';
import { Icon } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';
import getCroppedImg from '../utils/cropImage';

interface ProfilePhotoModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentAvatarUrl: string | null;
    userName: string;
}

export const ProfilePhotoModal: React.FC<ProfilePhotoModalProps> = ({
    isOpen,
    onClose,
    currentAvatarUrl,
    userName
}) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [imageLoading, setImageLoading] = useState(false);

    // Crop State
    const [croppingImageSrc, setCroppingImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    const onCropComplete = (_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return;
        const file = event.target.files[0];

        // 1. Convert HEIC if needed
        let sourceFile: Blob = file;
        if (file.type.toLowerCase().includes('heic') || file.name.toLowerCase().endsWith('.heic')) {
            try {
                const converted = await heic2any({ blob: file, toType: 'image/jpeg' });
                sourceFile = Array.isArray(converted) ? converted[0] : converted;
            } catch (e) {
                console.error("HEIC Error", e);
            }
        }

        // 2. Read as URL for Cropper
        const reader = new FileReader();
        reader.readAsDataURL(sourceFile);
        reader.onload = () => {
            setCroppingImageSrc(reader.result as string);
            setZoom(1);
            setRotation(0);
            setCrop({ x: 0, y: 0 });
        };
    };

    const handleCropConfirm = async () => {
        if (!user || !croppingImageSrc || !croppedAreaPixels) {
            return;
        }

        setIsLoading(true);
        try {
            // 1. Get Cropped Blob
            const croppedBlob = await getCroppedImg(croppingImageSrc, croppedAreaPixels, rotation);
            if (!croppedBlob) throw new Error("Error creating cropped image blob");

            // 2. Upload
            const path = `${user?.id}/avatar.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(path, croppedBlob, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // 3. Get URL - Force new Unique ID
            const { data } = supabase.storage.from('avatars').getPublicUrl(path);
            const uniqueId = new Date().getTime().toString();
            const publicUrl = `${data.publicUrl}?t=${uniqueId}`;

            // 4. Update Profile
            const { error: authError } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
            if (authError) throw authError;

            // Optional: Update profile table if exists
            await supabase.from('profiles').upsert({ id: user.id, avatar_url: publicUrl });

            showToast("Imagen actualizada correctamente", "success");
            setCroppingImageSrc(null);
            onClose();
            // Force reload user metadata if necessary, but AuthContext usually has subscription
             setTimeout(() => {
                window.location.reload(); 
            }, 500);

        } catch (e: any) {
            console.error("CROP ERROR FULL:", e);
            showToast(`Error al guardar: ${e.message}`, "error");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                    />

                    {/* Main Modal Content */}
                    {!croppingImageSrc ? (
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.8, opacity: 0, y: 20 }}
                            className="relative w-full max-w-sm bg-white rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
                        >
                            <div className="flex flex-col items-center gap-6">
                                <div className="relative size-40 group">
                                    <div className="w-full h-full rounded-full ring-4 ring-primary/20 shadow-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                                        <img
                                            src={currentAvatarUrl || `https://ui-avatars.com/api/?name=${userName.replace(' ', '+')}&background=random`}
                                            alt="Profile"
                                            className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                                            onLoad={() => setImageLoading(false)}
                                        />
                                        {imageLoading && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                                                <div className="animate-spin rounded-full size-8 border-2 border-primary border-t-transparent" />
                                            </div>
                                        )}
                                    </div>

                                    {isLoading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px] rounded-full z-10 transition-all">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="animate-spin rounded-full size-10 border-4 border-primary border-t-transparent" />
                                                <span className="text-xs font-bold text-primary animate-pulse">Subiendo...</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="text-center space-y-1">
                                    <h3 className="text-xl font-bold text-slate-900">{userName}</h3>
                                    <p className="text-sm text-slate-500 font-medium">Foto de perfil</p>
                                </div>

                                <div className="flex flex-col w-full gap-3">
                                    <label
                                        htmlFor="avatar-upload-main"
                                        className="w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                                    >
                                        <Icon name="edit" size={20} />
                                        Cambiar foto
                                        <input
                                            type="file"
                                            id="avatar-upload-main"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleFileSelect}
                                            disabled={isLoading}
                                        />
                                    </label>

                                    <button
                                        onClick={onClose}
                                        className="w-full py-4 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-2xl transition-colors"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        /* Cropper Overlay */
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[110] bg-black flex flex-col"
                        >
                            <div className="flex justify-between items-center p-6 bg-black/50 absolute top-0 left-0 right-0 z-10 backdrop-blur-md">
                                <button
                                    onClick={() => setCroppingImageSrc(null)}
                                    className="text-white bg-white/10 p-3 rounded-full hover:bg-white/20 transition-colors"
                                >
                                    <Icon name="x" size={24} />
                                </button>
                                <h3 className="text-white font-bold text-lg">Ajustar foto</h3>
                                <button
                                    onClick={handleCropConfirm}
                                    className="text-white bg-primary px-6 py-2 rounded-full font-bold shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                                >
                                    Listo
                                </button>
                            </div>

                            <div className="relative flex-1 w-full bg-black min-h-0">
                                <Cropper
                                    image={croppingImageSrc}
                                    crop={crop}
                                    zoom={zoom}
                                    rotation={rotation}
                                    aspect={1}
                                    onCropChange={setCrop}
                                    onCropComplete={onCropComplete}
                                    onZoomChange={setZoom}
                                    onRotationChange={setRotation}
                                    cropShape="round"
                                    showGrid={false}
                                />
                            </div>

                            <div className="px-8 py-10 flex flex-col gap-8 bg-slate-900 border-t border-white/10 rounded-t-[3rem]">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                                        <span>Zoom</span>
                                        <span className="text-white bg-white/10 px-2 py-0.5 rounded-md">{Math.round(zoom * 100)}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        value={zoom}
                                        min={1}
                                        max={3}
                                        step={0.01}
                                        onChange={(e) => setZoom(Number(e.target.value))}
                                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                </div>
                                <p className="text-center text-xs text-slate-500 font-medium">
                                    Arrastra la foto para centrarla
                                </p>
                            </div>
                        </motion.div>
                    )}
                </div>
            )}
        </AnimatePresence>
    );
};
