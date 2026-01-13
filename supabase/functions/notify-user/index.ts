import { createClient } from 'jsr:@supabase/supabase-js@2'
import admin from 'firebase-admin'

let firebaseInitialized = false;

const initFirebase = async (supabaseAdmin: any) => {
    if (firebaseInitialized) return;
    const { data: configData } = await supabaseAdmin.from('app_config').select('value').eq('key', 'FIREBASE_CONFIG').single();
    if (!configData?.value) throw new Error('FIREBASE_CONFIG not found');
    if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.cert(JSON.parse(configData.value)) })
    }
    firebaseInitialized = true;
};

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { userId, title, body, type = 'info' } = await req.json()
        if (!userId || !title || !body) throw new Error('Missing fields')

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        await initFirebase(supabaseAdmin);

        // 1. PERSISTENCE
        await supabaseAdmin.from('announcements').insert({
            user_id: userId, title, message: body, type, is_active: true, created_at: new Date().toISOString()
        })

        // 2. FETCH TOKENS
        const { data: devices } = await supabaseAdmin.from('user_devices').select('fcm_token').eq('user_id', userId)
        if (devices && devices.length > 0) {
            await admin.messaging().sendEachForMulticast({
                notification: { title, body },
                tokens: devices.map(d => d.fcm_token)
            })
        }

        return new Response(JSON.stringify({ message: 'Notification processed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
})
