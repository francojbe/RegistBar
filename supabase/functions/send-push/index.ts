import { createClient } from 'jsr:@supabase/supabase-js@2'
import admin from 'firebase-admin'

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

let firebaseInitialized = false;

const initFirebase = async (supabaseAdmin: any) => {
    if (firebaseInitialized) return;

    const { data: configData } = await supabaseAdmin
        .from('app_config')
        .select('value')
        .eq('key', 'FIREBASE_CONFIG')
        .single();

    if (!configData?.value) {
        throw new Error('FIREBASE_CONFIG not found in app_config');
    }

    const firebaseConfig = JSON.parse(configData.value);

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(firebaseConfig),
        })
    }
    firebaseInitialized = true;
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { userId, title, body, type = 'info' } = await req.json()

        if (!userId || !title || !body) {
            throw new Error('Missing required fields: userId, title, body')
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Initialize Firebase from DB
        await initFirebase(supabaseAdmin);

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
        )

        // 1. Save to History
        const { error: dbError } = await supabaseAdmin
            .from('announcements')
            .insert({
                user_id: userId,
                title: title,
                message: body,
                type: type,
                is_active: true,
                created_at: new Date().toISOString()
            })

        // 2. Fetch Tokens
        const { data: devices, error } = await supabaseAdmin
            .from('user_devices')
            .select('fcm_token')
            .eq('user_id', userId)

        if (error) throw error

        if (!devices || devices.length === 0) {
            return new Response(JSON.stringify({ message: 'User has no registered devices', savedToHistory: !dbError }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            })
        }

        const tokens = devices.map(d => d.fcm_token)

        // 3. Send Push Notification
        const message = {
            notification: { title, body },
            tokens: tokens,
        }

        const response = await admin.messaging().sendEachForMulticast(message)

        return new Response(JSON.stringify({
            message: 'Push tokens processed',
            successCount: response.successCount,
            failureCount: response.failureCount,
            savedToHistory: !dbError
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (err: any) {
        console.error("Error in send-push:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        })
    }
})
