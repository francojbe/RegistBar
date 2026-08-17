
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

interface CurrencyConfig {
    code: string;
    locale: string;
    symbol: string;
    name: string;
}

const CURRENCY_MAP: Record<string, CurrencyConfig> = {
    // North America
    'USD': { code: 'USD', locale: 'en-US', symbol: '$', name: 'Dólar Estadounidense' },
    'MXN': { code: 'MXN', locale: 'es-MX', symbol: '$', name: 'Peso Mexicano' },

    // South America
    'CLP': { code: 'CLP', locale: 'es-CL', symbol: '$', name: 'Peso Chileno' },
    'ARS': { code: 'ARS', locale: 'es-AR', symbol: '$', name: 'Peso Argentino' },
    'COP': { code: 'COP', locale: 'es-CO', symbol: '$', name: 'Peso Colombiano' },
    'PEN': { code: 'PEN', locale: 'es-PE', symbol: 'S/', name: 'Sol Peruano' },
    'VES': { code: 'VES', locale: 'es-VE', symbol: 'Bs.', name: 'Bolívar Venezolano' }, // Or use USD locale if preferred
    'BOB': { code: 'BOB', locale: 'es-BO', symbol: 'Bs', name: 'Boliviano' },
    'UYU': { code: 'UYU', locale: 'es-UY', symbol: '$', name: 'Peso Uruguayo' },
    'PYG': { code: 'PYG', locale: 'es-PY', symbol: '₲', name: 'Guaraní' },
    'BRL': { code: 'BRL', locale: 'pt-BR', symbol: 'R$', name: 'Real Brasileño' },

    // Central America & Caribbean
    'CRC': { code: 'CRC', locale: 'es-CR', symbol: '₡', name: 'Colón Costarricense' },
    'DOP': { code: 'DOP', locale: 'es-DO', symbol: 'RD$', name: 'Peso Dominicano' },
    'GTQ': { code: 'GTQ', locale: 'es-GT', symbol: 'Q', name: 'Quetzal' },
    'HNL': { code: 'HNL', locale: 'es-HN', symbol: 'L', name: 'Lempira' },
    'NIO': { code: 'NIO', locale: 'es-NI', symbol: 'C$', name: 'Córdoba' },
    'PAB': { code: 'USD', locale: 'en-US', symbol: '$', name: 'Balboa / Dólar' }, // Panama uses USD mostly

    // Europe
    'EUR': { code: 'EUR', locale: 'es-ES', symbol: '€', name: 'Euro' },
};

// Global cache to avoid refetching on every component mount
let globalCurrencyCache: string | null = null;

// Global privacy state
let isPrivacyModeGlobal: boolean = typeof window !== 'undefined' 
    ? localStorage.getItem('registbar_privacy_mode') === 'true' 
    : false;
const privacyListeners = new Set<(hidden: boolean) => void>();

export const togglePrivacyMode = () => {
    isPrivacyModeGlobal = !isPrivacyModeGlobal;
    if (typeof window !== 'undefined') {
        localStorage.setItem('registbar_privacy_mode', String(isPrivacyModeGlobal));
    }
    privacyListeners.forEach(listener => listener(isPrivacyModeGlobal));
    return isPrivacyModeGlobal;
};

export const setPrivacyMode = (hidden: boolean) => {
    isPrivacyModeGlobal = hidden;
    if (typeof window !== 'undefined') {
        localStorage.setItem('registbar_privacy_mode', String(isPrivacyModeGlobal));
    }
    privacyListeners.forEach(listener => listener(isPrivacyModeGlobal));
};

export const getPrivacyMode = () => isPrivacyModeGlobal;

export const useCurrency = () => {
    const { user } = useAuth();
    const [currencyCode, setCurrencyCode] = useState<string>('CLP');
    const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(isPrivacyModeGlobal);

    useEffect(() => {
        const listener = (hidden: boolean) => setIsPrivacyMode(hidden);
        privacyListeners.add(listener);
        return () => {
            privacyListeners.delete(listener);
        };
    }, []);

    useEffect(() => {
        if (!user) return;

        // 1. Check Cache
        if (globalCurrencyCache) {
            setCurrencyCode(globalCurrencyCache);
            return;
        }

        // 2. Fetch from DB
        const fetchCurrency = async () => {
            try {
                const { data } = await supabase
                    .from('profiles')
                    .select('currency')
                    .eq('id', user.id)
                    .maybeSingle();

                const curr = data?.currency || 'CLP';
                globalCurrencyCache = curr;
                setCurrencyCode(curr);
            } catch (err) {
                console.error("Error fetching currency:", err);
            }
        };

        fetchCurrency();
    }, [user]);

    const config = CURRENCY_MAP[currencyCode] || CURRENCY_MAP['CLP'];

    const format = (amount: number | string | undefined | null) => {
        if (isPrivacyMode) {
            return config.symbol + " ••••••";
        }

        if (amount === undefined || amount === null || amount === '') return config.symbol + " 0";

        const num = Number(amount);
        if (isNaN(num)) return config.symbol + " 0";

        // Currencies that typically don't use decimals in daily display
        const NO_DECIMALS = ['CLP', 'PYG', 'COP', 'HNL', 'JPY', 'KRW', 'VND'];
        const fractionDigits = NO_DECIMALS.includes(config.code) ? 0 : 2;

        return config.symbol + " " + num.toLocaleString(config.locale, {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits
        });
    };

    return {
        ...config,
        isPrivacyMode,
        togglePrivacyMode,
        setPrivacyMode,
        format
    };
};
