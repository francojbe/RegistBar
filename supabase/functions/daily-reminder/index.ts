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

Deno.serve(async (req) => {
    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        await initFirebase(supabaseAdmin);

        // 1. Get Distinct Active Users
        const { data: users } = await supabaseAdmin.from('user_devices').select('user_id')
        const uniqueUserIds = [...new Set(users?.map(u => u.user_id))];

        if (!uniqueUserIds.length) return new Response(JSON.stringify({ message: 'No users' }))

        const title = "⏰ Recordatorio Diario";
        const body = "¿Ya registraste tus ingresos de hoy? No pierdas el hilo de tus finanzas.";

        for (const userId of uniqueUserIds) {
            await supabaseAdmin.from('announcements').insert({
                user_id: userId, title, message: body, type: 'info', is_active: true, created_at: new Date().toISOString()
            })

            const { data: devices } = await supabaseAdmin.from('user_devices').select('fcm_token').eq('user_id', userId)
            if (devices && devices.length > 0) {
                await admin.messaging().sendEachForMulticast({
                    notification: { title, body },
                    tokens: devices.map(d => d.fcm_token)
                })
            }
        }

        return new Response(JSON.stringify({ message: `Reminders sent to ${uniqueUserIds.length} users` }), { status: 200 })
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
})
