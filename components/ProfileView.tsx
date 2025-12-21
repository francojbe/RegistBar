import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';
import { ChangePasswordModal } from './ChangePasswordModal';
import { NotificationsModal } from './NotificationsModal';
import { SupportModal } from './SupportModal';
import { AdminView } from './AdminView';
import { NativeBiometric } from 'capacitor-native-biometric';
import heic2any from 'heic2any';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';

export const ProfileView: React.FC = () => {
    const { user, signOut } = useAuth();
    const { showToast } = useToast();
    // Savings Plan State
    const [goalName, setGoalName] = useState("Mi Meta");
    const [goalAmount, setGoalAmount] = useState<number>(0);
    const [savedAmount, setSavedAmount] = useState<number>(0);
    const [savingsRate, setSavingsRate] = useState<number>(10);
    const [commissionRate, setCommissionRate] = useState<number>(40);
    const [expenseModel, setExpenseModel] = useState<'commission' | 'rent'>('commission');
    const [rentAmount, setRentAmount] = useState<number>(0);
    const [rentPeriod, setRentPeriod] = useState<'weekly' | 'monthly'>('monthly');

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showSupportModal, setShowSupportModal] = useState(false);
    const [showAdminView, setShowAdminView] = useState(false);
    const [currentTheme, setCurrentTheme] = useState<'default' | 'ocean'>('default');
    const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
    const [showBiometricModal, setShowBiometricModal] = useState(false);
    const [biometricPassword, setBiometricPassword] = useState('');

    // Temp state for editing
    const [editGoalName, setEditGoalName] = useState("");
    const [editGoalAmount, setEditGoalAmount] = useState<number | string>(0);
    const [editSavingsRate, setEditSavingsRate] = useState(10);
    const [editCommissionRate, setEditCommissionRate] = useState(40);
    const [editExpenseModel, setEditExpenseModel] = useState<'commission' | 'rent'>('commission');
    const [editRentAmount, setEditRentAmount] = useState<number | string>('');
    const [editRentPeriod, setEditRentPeriod] = useState<'weekly' | 'monthly'>('monthly');
    const [editUserName, setEditUserName] = useState(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || "Usuario");

    // Avatar & User Info State
    const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.user_metadata?.avatar_url || null);
    const [userName, setUserName] = useState(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || "Usuario");
    const [userPlan, setUserPlan] = useState("Plan Básico");
    const [totalServices, setTotalServices] = useState(0);

    // Fetch Data on Mount
    React.useEffect(() => {
        if (!user) return;

        // Update local state if user context updates (e.g. fresh fetch completed)
        if (user.user_metadata?.avatar_url && user.user_metadata.avatar_url !== avatarUrl) {
            setAvatarUrl(user.user_metadata.avatar_url);
        }

        const metaName = user.user_metadata.full_name || user.user_metadata.name || user.email?.split('@')[0];
        if (metaName && metaName !== userName) {
            setUserName(metaName);
            setEditUserName(metaName);
        }

        const fetchData = async () => {
            // Fetch Goal
            const { data: goalData } = await supabase
                .from('goals')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (goalData) {
                setGoalName(goalData.name || "Mi Meta");
                setGoalAmount(goalData.target_amount || 0);
                setSavedAmount(goalData.current_amount || 0);
                setSavingsRate(goalData.savings_rate || 10);

                // Init edit state
                setEditGoalName(goalData.name || "Mi Meta");
                setEditGoalAmount(goalData.target_amount || 0);
                setEditSavingsRate(goalData.savings_rate || 10);
            }

            // Fetch Profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('commission_rate, first_name, last_name, expense_model, rent_amount, rent_period')
                .eq('id', user.id)
                .single();

            if (profileData) {
                setCommissionRate(profileData.commission_rate ?? 40);
                setExpenseModel(profileData.expense_model || 'commission');
                setRentAmount(profileData.rent_amount || 0);
                setRentPeriod(profileData.rent_period || 'monthly');

                setEditCommissionRate(profileData.commission_rate ?? 40);
                setEditExpenseModel(profileData.expense_model || 'commission');
                setEditRentAmount(profileData.rent_amount || 0);
                setEditRentPeriod(profileData.rent_period || 'monthly');

                if (profileData.first_name) {
                    const fullName = `${profileData.first_name} ${profileData.last_name || ''}`.trim();
                    setUserName(fullName);
                    setEditUserName(fullName);
                }
            }

            // Fetch Total Services Count
            const { count } = await supabase
                .from('transactions')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('category', 'service');

            setTotalServices(count || 0);
        };

        fetchData();

        // Initialize theme state
        const savedTheme = localStorage.getItem('theme') as 'default' | 'ocean';
        if (savedTheme) {
            setCurrentTheme(savedTheme);
        } else if (document.body.classList.contains('theme-ocean')) {
            setCurrentTheme('ocean');
        }

        const bioEnabled = localStorage.getItem('biometric_enabled') === 'true';
        setIsBiometricEnabled(bioEnabled);
    }, [user]);

    const [imageLoading, setImageLoading] = useState(false);

    // Crop State
    const [croppingImageSrc, setCroppingImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    // Helper to compress image (Only used if NOT cropping, or double compression)
    // We'll simplify this now since the Cropper logic handles a lot

    const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
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
            console.error("Missing data for crop", { user: !!user, src: !!croppingImageSrc, pixels: !!croppedAreaPixels });
            return;
        }

        setIsLoading(true);
        try {
            console.log("Starting crop process...");
            // 1. Get Cropped Blob
            const croppedBlob = await getCroppedImg(croppingImageSrc, croppedAreaPixels, rotation);
            if (!croppedBlob) throw new Error("Error creating cropped image blob");
            console.log("Blob created", croppedBlob.size);

            // 2. Upload
            const path = `${user?.id}/avatar.jpg`;

            // Try to remove old one just in case upsert is being stubborn
            // await supabase.storage.from('avatars').remove([path]); 

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(path, croppedBlob, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (uploadError) {
                console.error("Supabase Upload Error:", uploadError);
                throw uploadError;
            }
            console.log("Upload success", uploadData);

            // 3. Get URL - Force new Unique ID
            const { data } = supabase.storage.from('avatars').getPublicUrl(path);
            const uniqueId = new Date().getTime().toString() + Math.random().toString(36).substring(7);
            const publicUrl = `${data.publicUrl}?t=${uniqueId}`;

            console.log("New Public URL:", publicUrl);

            // 4. Update Profile
            const { error: authError } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
            if (authError) {
                console.error("Auth Update Error:", authError);
                throw authError;
            }

            // Update local state immediately
            setAvatarUrl(publicUrl);
            setCroppingImageSrc(null);
            showToast("Imagen actualizada correctamente", "success");

        } catch (e: any) {
            console.error("CROP ERROR FULL:", e);
            showToast(`Error al guardar: ${e.message}`, "error");
        } finally {
            setIsLoading(false);
        }
    };

    // Cancel Crop
    const handleCropCancel = () => {
        setCroppingImageSrc(null);
    };

    const handleEnableBiometric = async () => {
        if (!user || !biometricPassword) return;
        setIsLoading(true);

        try {
            // Verify password first by trying to sign in again
            const { error } = await supabase.auth.signInWithPassword({
                email: user.email!,
                password: biometricPassword
            });

            if (error) throw new Error("Contraseña incorrecta");

            // Verify biometric capability
            const available = await NativeBiometric.isAvailable();
            if (!available.isAvailable) throw new Error("Biometría no disponible en este dispositivo");

            // Save credentials
            await NativeBiometric.setCredentials({
                server: 'com.registbar.app',
                username: user.email!,
                password: biometricPassword,
            });

            localStorage.setItem('biometric_enabled', 'true');
            setIsBiometricEnabled(true);
            setShowBiometricModal(false);
            setBiometricPassword('');
            showToast("Acceso con huella activado correctamente", "success");

        } catch (error: any) {
            console.error("Biometric setup error:", error);
            showToast(error.message || "Error al activar huella", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDisableBiometric = async () => {
        try {
            await NativeBiometric.deleteCredentials({
                server: 'com.registbar.app',
            });
            localStorage.setItem('biometric_enabled', 'false');
            setIsBiometricEnabled(false);
            showToast("Acceso con huella desactivado", "info");
        } catch (e) {
            console.error(e);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setIsLoading(true);

        try {
            // 1. Upsert Goal
            const { data: existingGoals, error: fetchError } = await supabase
                .from('goals')
                .select('id')
                .eq('user_id', user.id)
                .limit(1);

            if (fetchError) throw fetchError;

            const existingGoal = existingGoals && existingGoals.length > 0 ? existingGoals[0] : null;

            const goalPayload = {
                user_id: user.id,
                name: editGoalName,
                title: editGoalName,
                target_amount: Number(editGoalAmount) || 0,
                savings_rate: editSavingsRate,
            };

            if (existingGoal) {
                const { error } = await supabase.from('goals').update(goalPayload).eq('id', existingGoal.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('goals').insert([{ ...goalPayload, current_amount: 0 }]);
                if (error) throw error;
            }

            // 2. Upsert Profile (Name & Commission)
            const nameParts = editUserName.trim().split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    commission_rate: editCommissionRate,
                    expense_model: editExpenseModel,
                    rent_amount: Number(editRentAmount) || 0,
                    rent_period: editRentPeriod,
                    first_name: firstName,
                    last_name: lastName
                });

            if (profileError) throw profileError;

            await supabase.auth.updateUser({
                data: { full_name: editUserName }
            });

            // Update Local State
            setGoalName(editGoalName);
            setGoalAmount(Number(editGoalAmount) || 0);
            setSavingsRate(editSavingsRate);
            setCommissionRate(editCommissionRate);
            setExpenseModel(editExpenseModel);
            setRentAmount(Number(editRentAmount) || 0);
            setRentPeriod(editRentPeriod);
            setUserName(editUserName);
            setIsEditing(false);

            showToast('¡Cambios guardados correctamente!', "success");
        } catch (error: any) {
            console.error('Error saving profile:', error);
            showToast(`Hubo un error al guardar: ${JSON.stringify(error, null, 2) || error.message || 'Error desconocido'}`, "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setEditGoalName(goalName);
        setEditGoalAmount(goalAmount);
        setEditSavingsRate(savingsRate);
        setEditCommissionRate(commissionRate);
        setEditExpenseModel(expenseModel);
        setEditRentAmount(rentAmount);
        setEditRentPeriod(rentPeriod);
        setEditUserName(userName);
        setIsEditing(false);
    };

    const progress = Math.min((savedAmount / goalAmount) * 100, 100);

    return (
        <div className="flex flex-col gap-4 animate-fade-in-up pb-8 relative">

            {/* Cropper Modal Overlay */}
            <AnimatePresence>
                {croppingImageSrc && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-black flex flex-col h-screen w-screen"
                    >
                        {/* Header Controls */}
                        <div className="flex justify-between items-center p-4 bg-black/50 absolute top-0 left-0 right-0 z-10">
                            <button onClick={handleCropCancel} className="text-white p-2">
                                <Icon name="x" size={24} />
                            </button>
                            <h3 className="text-white font-bold">Ajustar Foto</h3>
                            <button onClick={handleCropConfirm} className="text-primary font-bold p-2">
                                Guardar
                            </button>
                        </div>

                        {/* Cropper Container - Needs explicit relative positioning and size */}
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
                                objectFit="contain"
                            />
                        </div>

                        {/* Bottom Controls */}
                        <div className="px-6 py-8 flex flex-col gap-6 bg-slate-900 pb-12">
                            <div className="flex items-center gap-4">
                                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Alejar</span>
                                <input
                                    type="range"
                                    value={zoom}
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    aria-labelledby="Zoom"
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                                <span className="text-xs font-medium text-white uppercase tracking-wider">Acercar</span>
                            </div>

                            <div className="flex justify-center text-xs text-slate-400">
                                Pellizca para zoom, arrastra para mover
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Existing Header */}
            <header className="flex items-center justify-between py-2">
                <h1 className="text-2xl font-bold text-slate-900">Mi Perfil</h1>
                <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <Icon name="settings" size={24} />
                </button>
            </header>

            {/* Profile Summary with NEW Loading State */}
            <div className="flex flex-col items-center gap-2 py-1">
                <div className="relative mx-auto size-24">
                    {/* Ring and Shadow Container */}
                    <div className="relative w-full h-full rounded-full ring-4 ring-white shadow-lg overflow-hidden bg-white">
                        <img
                            src={avatarUrl || `https://ui-avatars.com/api/?name=${userName.replace(' ', '+')}&background=random`}
                            alt="Profile"
                            className={`w-full h-full object-cover transition-all duration-500 ${imageLoading ? 'opacity-50 blur-sm scale-110' : 'opacity-100 scale-100'}`}
                            onLoad={() => setImageLoading(false)}
                            onError={() => setImageLoading(false)}
                        />

                        {/* Loading Overlay */}
                        {(isLoading || imageLoading) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px] z-10">
                                <Icon name="refresh" className="animate-spin text-white drop-shadow-md" size={24} />
                            </div>
                        )}
                    </div>

                    <label
                        htmlFor="avatar-upload"
                        className="absolute bottom-0 right-0 translate-x-1 translate-y-1 bg-white p-2 rounded-full shadow-md border border-slate-200 cursor-pointer hover:bg-slate-50 transition-all hover:scale-105 active:scale-95 flex items-center justify-center z-20"
                        title="Cambiar foto"
                    >
                        <Icon name="edit" size={16} className="text-primary" />
                        <input
                            type="file"
                            id="avatar-upload"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileSelect}
                            disabled={isLoading}
                        />
                    </label>
                </div>
                <div className="text-center">
                    <h2 className="text-xl font-bold text-slate-900">{userName}</h2>
                    <p className="text-sm text-slate-500">{userPlan}</p>
                </div>

                <div className="flex gap-4 w-full justify-center">
                    <div className="flex flex-col items-center p-3 bg-white rounded-2xl shadow-soft min-w-[120px]">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Servicios Totales</span>
                        <span className="text-lg font-bold text-slate-900">{totalServices}</span>
                    </div>
                </div>
            </div>

            {/* Config Section */}
            <div className="bg-white rounded-[2.5rem] p-6 shadow-soft relative overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-pink-100 text-primary">
                            <Icon name="savings" size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 leading-none">Configuración</h3>
                            <p className="text-xs text-slate-400 mt-1">Metas y Costos</p>
                        </div>
                    </div>
                </div>

                <AnimatePresence mode='wait'>
                    {isEditing ? (
                        <motion.div
                            key="editing"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex flex-col gap-4"
                        >
                            {/* User Name */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Tu Nombre</label>
                                <input
                                    type="text"
                                    value={editUserName}
                                    onChange={(e) => setEditUserName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-medium focus:outline-none focus:border-primary/50 transition-colors"
                                />
                            </div>

                            {/* Goal Name */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Nombre de la Meta</label>
                                <input
                                    type="text"
                                    value={editGoalName}
                                    onChange={(e) => setEditGoalName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-medium focus:outline-none focus:border-primary/50 transition-colors"
                                />
                            </div>

                            {/* Goal Amount */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Monto Objetivo</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={editGoalAmount}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            setEditGoalAmount(val === '' ? '' : Number(val));
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-3 text-slate-900 font-medium focus:outline-none focus:border-primary/50 transition-colors"
                                    />
                                </div>
                            </div>



                            {/* NEW: Expenses Model Selector */}
                            <div className="flex flex-col gap-3 pt-4 border-t border-dashed border-slate-200">
                                <label className="text-xs font-bold text-slate-500 uppercase">Modelo de Costo (Salón)</label>

                                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                                    <button
                                        onClick={() => setEditExpenseModel('commission')}
                                        className={`py-2 text-sm font-bold rounded-lg transition-all ${editExpenseModel === 'commission' ? 'bg-white shadow text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        % Comisión
                                    </button>
                                    <button
                                        onClick={() => setEditExpenseModel('rent')}
                                        className={`py-2 text-sm font-bold rounded-lg transition-all ${editExpenseModel === 'rent' ? 'bg-white shadow text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        $ Arriendo
                                    </button>
                                </div>

                                {editExpenseModel === 'commission' ? (
                                    <div className="flex flex-col gap-2 animate-fade-in">
                                        <div className="flex gap-2">
                                            {[0, 30, 40, 50, 60].map((rate) => (
                                                <button
                                                    key={rate}
                                                    onClick={() => setEditCommissionRate(rate)}
                                                    className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${editCommissionRate === rate
                                                        ? 'bg-primary text-white shadow-md'
                                                        : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                                >
                                                    {rate}%
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-slate-400 px-1">
                                            <span>Porcentaje retenido por servicio</span>
                                            <span className="font-bold text-slate-600">{editCommissionRate}%</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3 animate-fade-in">
                                        <div className="flex gap-3">
                                            <select
                                                value={editRentPeriod}
                                                onChange={(e) => setEditRentPeriod(e.target.value as 'weekly' | 'monthly')}
                                                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:border-primary/50"
                                            >
                                                <option value="weekly">Semanal</option>
                                                <option value="monthly">Mensual</option>
                                            </select>
                                            <div className="relative flex-1">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                                <input
                                                    type="tel"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={editRentAmount}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                                        setEditRentAmount(val);
                                                    }}
                                                    placeholder="Monto"
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-4 py-3 text-slate-900 font-bold outline-none focus:border-primary/50"
                                                />
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-400 px-1">
                                            Monto fijo que pagas por el arriendo del sillón.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={handleCancel}
                                    className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:brightness-110 transition-colors shadow-lg shadow-primary/30"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="viewing"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex flex-col gap-5"
                        >
                            {/* Current Goal Display */}
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Meta Actual</span>
                                <h4 className="text-lg font-bold text-slate-900 mb-2">{goalName}</h4>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-extrabold text-primary">${savedAmount.toLocaleString('es-CL')}</span>
                                    <span className="text-sm font-medium text-slate-500">/ ${goalAmount.toLocaleString('es-CL')}</span>
                                </div>

                                {/* Progress Bar */}
                                <div className="mt-4 relative w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between mt-2 text-xs font-medium text-slate-400">
                                    <span>0%</span>
                                    <span>{Math.round(progress)}% Completado</span>
                                    <span>100%</span>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="flex flex-col gap-3">
                                {/* Dynamic Expense Card */}
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 w-full">
                                    {expenseModel === 'commission' ? (
                                        <>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Icon name="storefront" size={16} className="text-orange-500" />
                                                <span className="text-xs font-bold text-slate-400 uppercase">Comisión</span>
                                            </div>
                                            <p className="text-base font-bold text-slate-900">{commissionRate}%</p>
                                            <p className="text-[10px] text-slate-500">Salón</p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Icon name="storefront" size={16} className="text-purple-500" />
                                                <span className="text-xs font-bold text-slate-400 uppercase">Arriendo</span>
                                            </div>
                                            <p className="text-base font-bold text-slate-900">
                                                ${Number(rentAmount).toLocaleString('es-CL')}
                                            </p>
                                            <p className="text-[10px] text-slate-500 capitalize">{rentPeriod === 'weekly' ? 'Semanal' : 'Mensual'}</p>
                                        </>
                                    )}
                                </div>
                            </div>

                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Other Settings */}
            <div className="bg-white rounded-[2.5rem] p-4 shadow-soft">
                {/* Theme Toggle */}
                <button
                    onClick={async () => {
                        const isOcean = currentTheme === 'ocean';
                        // Toggle: If currently Ocean, go to Automatic (null). If not Ocean, go to Ocean.
                        const newTheme = isOcean ? null : 'ocean';

                        // Update Local State for UI feedback
                        // If going to null, we need to know what validity to show immediately?
                        // For simplicity in this toggle, if we turn OFF ocean, we revert to visual 'default' state in the Switch
                        // but the actual app theme will reactively change based on App.tsx logic
                        setCurrentTheme(newTheme === 'ocean' ? 'ocean' : 'default');

                        // Update body class immediately for responsiveness (App.tsx will double check this later)
                        if (newTheme === 'ocean') {
                            document.body.classList.add('theme-ocean');
                            localStorage.setItem('theme', 'ocean');
                        } else {
                            // If clearing, we remove explicit theme classes and let App.tsx logic re-apply based on gender
                            // Actually, safest is to clear storage and wait for App.tsx or reload, 
                            // BUT to avoid flicker let's just remove ocean.
                            document.body.classList.remove('theme-ocean');
                            localStorage.removeItem('theme');

                            // A re-render of App.tsx is triggered by DB change usually, but local storage removal needs a window event or context
                            // For now, removing the class is enough visual feedback that "Executive Mode" is off.
                            // To be perfect, we should manually check gender here to apply 'theme-pink' if needed? 
                            // Yes, let's do a quick client-side check to mimic App.tsx behavior for immediate feedback
                            if (user?.user_metadata?.gender === 'female') {
                                document.body.classList.add('theme-pink');
                            } else {
                                document.body.classList.remove('theme-pink');
                            }
                        }

                        // Save to Supabase metadata so it persists globally
                        // We use 'null' string or actual null? Supabase update usually takes JSON.
                        // Setting a key to null in jsonb_set usually requires specific syntax or just sending the whole object.
                        // But updateUser data merges. sending { theme: null } deletes it/sets to null.
                        await supabase.auth.updateUser({
                            data: { theme: newTheme }
                        });
                    }}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors group mb-1"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-slate-100 text-slate-400 group-hover:text-primary transition-colors">
                            <Icon name="palette" size={20} />
                        </div>
                        <div className="text-left">
                            <span className="text-sm font-bold text-slate-900 block">Apariencia</span>
                            <span className="text-xs text-slate-500">
                                {currentTheme === 'ocean' ? 'Modo Ejecutivo' : 'Modo Original'}
                            </span>
                        </div>
                    </div>
                    <div className={`w-12 h-6 rounded-full p-1 transition-colors transition-all duration-300 ${currentTheme === 'ocean' ? 'bg-[#0e7490]' : 'bg-slate-200'}`}>
                        <div
                            className={`size-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${currentTheme === 'ocean' ? 'translate-x-6' : 'translate-x-0'}`}
                        />
                    </div>
                </button>

                {[
                    { icon: 'lock', label: 'Seguridad y Contraseña' },
                    { icon: 'fingerprint', label: 'Seguridad Biométrica' },
                    { icon: 'notifications', label: 'Notificaciones' },
                    { icon: 'help', label: 'Ayuda y Soporte' },
                ].map((item, idx) => (
                    <button
                        key={idx}
                        onClick={() => {
                            if (item.label === 'Seguridad y Contraseña') {
                                setShowChangePassword(true);
                            } else if (item.label === 'Seguridad Biométrica') {
                                if (isBiometricEnabled) {
                                    handleDisableBiometric();
                                } else {
                                    setShowBiometricModal(true);
                                }
                            } else if (item.label === 'Notificaciones') {
                                setShowNotifications(true);
                            } else if (item.label === 'Ayuda y Soporte') {
                                setShowSupportModal(true);
                            }
                        }}
                        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-slate-100 text-slate-400 group-hover:text-primary transition-colors">
                                <Icon name={item.icon} size={20} className={item.label === 'Seguridad Biométrica' && isBiometricEnabled ? 'text-primary' : ''} />
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-sm font-bold text-slate-900">{item.label}</span>
                                {item.label === 'Seguridad Biométrica' && (
                                    <span className={`text-[10px] font-bold ${isBiometricEnabled ? 'text-green-500' : 'text-slate-400'}`}>
                                        {isBiometricEnabled ? 'ACTIVADO' : 'DESACTIVADO'}
                                    </span>
                                )}
                            </div>
                        </div>
                        {item.label === 'Seguridad Biométrica' ? (
                            <div className={`w-10 h-5 rounded-full p-1 transition-colors ${isBiometricEnabled ? 'bg-primary' : 'bg-slate-200'}`}>
                                <div className={`size-3 bg-white rounded-full transition-transform ${isBiometricEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </div>
                        ) : (
                            <Icon name="chevron_right" size={20} className="text-slate-300 group-hover:text-primary transition-colors" />
                        )}
                    </button>
                ))}

                {/* Logout Button */}
                <button
                    onClick={async () => {
                        try {
                            await signOut();
                            showToast("Sesión cerrada correctamente", "success");
                        } catch (error) {
                            console.error("Error logging out", error);
                            showToast("Error al cerrar sesión", "error");
                        }
                    }}
                    className="w-full flex items-center justify-between p-4 text-red-500 hover:bg-red-50 rounded-2xl transition-colors group mt-2 border-t border-slate-100"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-red-100 text-red-500 group-hover:bg-red-200 transition-colors">
                            <Icon name="logout" size={20} />
                        </div>
                        <span className="text-sm font-bold">Cerrar Sesión</span>
                    </div>
                </button>

                {/* Admin Button - Restricted */}
                {user?.email === 'franco.blanco@efinnovation.cl' && (
                    <button
                        onClick={() => setShowAdminView(true)}
                        className="w-full flex items-center justify-center p-3 mt-4 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-900/20 active:scale-95 transition-all gap-2"
                    >
                        <Icon name="admin_panel_settings" size={18} />
                        <span className="text-sm font-bold">Panel de Administración</span>
                    </button>
                )}
            </div>

            <AnimatePresence>
                {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
                {showNotifications && <NotificationsModal onClose={() => setShowNotifications(false)} />}
                {showSupportModal && <SupportModal onClose={() => setShowSupportModal(false)} />}

                {/* Biometric Password Verification Modal */}
                {showBiometricModal && (
                    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="p-4 bg-primary/10 rounded-full text-primary">
                                    <Icon name="fingerprint" size={48} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">Activar Huella</h3>
                                <p className="text-sm text-slate-500">Por seguridad, ingresa tu contraseña para vincular el acceso biométrico.</p>

                                <div className="w-full mt-4 flex flex-col gap-4">
                                    <div className="group relative">
                                        <Icon name="lock" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
                                        <input
                                            type="password"
                                            placeholder="Tu contraseña"
                                            value={biometricPassword}
                                            onChange={(e) => setBiometricPassword(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3.5 text-slate-900 font-bold focus:outline-none focus:border-primary/50 transition-all"
                                        />
                                    </div>

                                    <div className="flex gap-3 mt-2">
                                        <button
                                            onClick={() => {
                                                setShowBiometricModal(false);
                                                setBiometricPassword('');
                                            }}
                                            className="flex-1 py-4 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleEnableBiometric}
                                            disabled={isLoading || !biometricPassword}
                                            className="flex-1 py-4 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 disabled:opacity-50"
                                        >
                                            {isLoading ? 'Vinculando...' : 'Confirmar'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {showAdminView && (
                    <motion.div
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        className="fixed inset-0 z-[60]"
                    >
                        <AdminView onClose={() => setShowAdminView(false)} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};
