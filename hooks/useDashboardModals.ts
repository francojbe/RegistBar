import { useState, useCallback } from 'react';
import { Transaction } from '../types';

export const useDashboardModals = () => {
    const [isFabOpen, setIsFabOpen] = useState(false);
    const [showScan, setShowScan] = useState(false);
    const [showTip, setShowTip] = useState(false);
    const [showNewService, setShowNewService] = useState(false);
    const [showSupplyExpense, setShowSupplyExpense] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfilePhoto, setShowProfilePhoto] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    const openScan = useCallback(() => {
        setIsFabOpen(false);
        setShowScan(true);
    }, []);

    const openTip = useCallback(() => {
        setIsFabOpen(false);
        setShowTip(true);
    }, []);

    const openNewService = useCallback(() => {
        setIsFabOpen(false);
        setShowNewService(true);
    }, []);

    const openSupplyExpense = useCallback(() => {
        setIsFabOpen(false);
        setShowSupplyExpense(true);
    }, []);

    const openNotifications = useCallback(() => {
        setShowNotifications(true);
    }, []);

    const openProfilePhoto = useCallback(() => {
        setShowProfilePhoto(true);
    }, []);

    const openEditTransaction = useCallback((tx: Transaction) => {
        setEditingTransaction(tx);
    }, []);

    const closeAll = useCallback(() => {
        setIsFabOpen(false);
        setShowScan(false);
        setShowTip(false);
        setShowNewService(false);
        setShowSupplyExpense(false);
        setShowNotifications(false);
        setShowProfilePhoto(false);
        setEditingTransaction(null);
    }, []);

    return {
        isFabOpen,
        setIsFabOpen,
        showScan,
        setShowScan,
        showTip,
        setShowTip,
        showNewService,
        setShowNewService,
        showSupplyExpense,
        setShowSupplyExpense,
        showNotifications,
        setShowNotifications,
        showProfilePhoto,
        setShowProfilePhoto,
        editingTransaction,
        setEditingTransaction,
        openScan,
        openTip,
        openNewService,
        openSupplyExpense,
        openNotifications,
        openProfilePhoto,
        openEditTransaction,
        closeAll,
    };
};
