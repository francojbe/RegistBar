import { Capacitor } from '@capacitor/core';
import { supabase } from '../supabaseClient';

export type AnalyticsEvent =
    | 'app_install_opened'
    | 'onboarding_completed'
    | 'first_transaction_logged'
    | 'service_created'
    | 'privacy_mode_toggled'
    | 'offline_sync_completed'
    | 'ocr_scan_attempted'
    | 'ocr_scan_confirmed'
    | 'daily_close_viewed'
    | 'whatsapp_share_clicked'
    | 'ai_advisor_prompted';

interface AnalyticsPayload {
    [key: string]: string | number | boolean | null | undefined;
}

/**
 * Privacy-first telemetry & analytics tracker.
 * Adheres strictly to RegistBar's data policy:
 * - NO exact financial amounts or PII (RUTs, emails, full names).
 * - Only categorized events, buckets, and platform indicators.
 */
export const trackEvent = async (event: AnalyticsEvent, params: AnalyticsPayload = {}) => {
    try {
        const platform = Capacitor.isNativePlatform() ? 'android' : 'pwa_web';
        const timestamp = new Date().toISOString();

        const enrichedPayload = {
            ...params,
            platform,
            timestamp,
        };

        // 1. Local Developer Logging
        if (import.meta.env.DEV) {
            console.log(`📊 [ANALYTICS] ${event}:`, enrichedPayload);
        }

        // 2. Safe async persist to Supabase if session exists (non-blocking)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            supabase
                .from('analytics_events')
                .insert({
                    user_id: user.id,
                    event_name: event,
                    properties: enrichedPayload,
                    created_at: timestamp
                })
                .then(({ error }) => {
                    // Silently ignore if table doesn't exist yet in local/testing
                    if (error && import.meta.env.DEV) {
                        console.debug('[ANALYTICS] Table insert notice:', error.message);
                    }
                })
                .catch(() => {});
        }
    } catch (err) {
        // Telemetry must never crash the app
        console.warn('Analytics tracking exception:', err);
    }
};

/**
 * Helper to categorize net balance into anonymous buckets
 */
export const getBalanceBucket = (amount: number): string => {
    if (amount <= 0) return 'zero_or_negative';
    if (amount < 50000) return 'under_50k';
    if (amount < 150000) return '50k_to_150k';
    if (amount < 300000) return '150k_to_300k';
    return 'over_300k';
};
