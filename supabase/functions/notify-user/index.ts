import { createClient } from 'jsr:@supabase/supabase-js@2'
import admin from 'firebase-admin'
const firebaseConfig = JSON.parse(Deno.env.get('FIREBASE_CONFIG') || '{}');

console.log("Central Notifier Started (Variable Version)");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig),
    })
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            },
        })
    }

    try {
        const { userId, title, body, type = 'info' } = await req.json()

        if (!userId || !title || !body) throw new Error('Missing fields')

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. PERSISTENCE
        await supabaseClient.from('announcements').insert({
            user_id: userId,
            title: title,
            message: body,
            type: type,
            is_active: true,
            created_at: new Date().toISOString()
        })

        // 2. FETCH TOKENS
        const { data: devices } = await supabaseClient.from('user_devices').select('fcm_token').eq('user_id', userId)

        if (devices && devices.length > 0) {
            const tokens = devices.map(d => d.fcm_token)
            await admin.messaging().sendEachForMulticast({
                notification: { title, body },
                tokens: tokens,
            })
        }

        return new Response(JSON.stringify({ message: 'Notification processed' }))

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
})
