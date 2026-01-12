import { createClient } from 'jsr:@supabase/supabase-js@2'
import admin from 'firebase-admin'
const firebaseConfig = JSON.parse(Deno.env.get('FIREBASE_CONFIG') || '{}');

console.log("Initializing Firebase Admin (Variable Version)...");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig),
    })
}

Deno.serve(async (req) => {
    // 1. Handle CORS preflight
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

        // 2. Validate Input
        if (!userId || !title || !body) {
            throw new Error('Missing required fields: userId, title, body')
        }

        // 3. Init Supabase Admin
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 4. Save to In-App History (Announcements Table)
        // This ensures it stays in the "campanita"
        const { error: dbError } = await supabaseClient
            .from('announcements')
            .insert({
                user_id: userId,
                title: title,
                message: body,
                type: type,
                is_active: true,
                created_at: new Date().toISOString()
            })

        if (dbError) {
            console.error('Error saving to history:', dbError);
            // We continue to send the push anyway
        }

        // 5. Fetch Tokens
        const { data: devices, error } = await supabaseClient
            .from('user_devices')
            .select('fcm_token')
            .eq('user_id', userId)

        if (error) throw error

        if (!devices || devices.length === 0) {
            return new Response(JSON.stringify({ message: 'User has no registered devices', savedToHistory: !dbError }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200
            })
        }

        const tokens = devices.map(d => d.fcm_token)

        // 6. Send Push Notification via Firebase
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
            headers: { 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (err: any) {
        console.error("Error in send-push:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
        })
    }
})
