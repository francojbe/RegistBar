import { createClient } from 'jsr:@supabase/supabase-js@2'
import admin from 'firebase-admin'
const firebaseConfig = JSON.parse(Deno.env.get('FIREBASE_CONFIG') || '{}');

console.log("Daily Reminder Cron Started (Variable Version)");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig),
    })
}

Deno.serve(async (req) => {
    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Get Distinct Active Users
        const { data: users } = await supabaseClient.from('user_devices').select('user_id')
        const uniqueUserIds = [...new Set(users?.map(u => u.user_id))];

        if (!uniqueUserIds.length) return new Response(JSON.stringify({ message: 'No users' }))

        const title = "⏰ Recordatorio Diario";
        const body = "¿Ya registraste tus ingresos de hoy? No pierdas el hilo de tus finanzas.";

        for (const userId of uniqueUserIds) {
            // 2. PERSISTENCE: Save to Announcements
            await supabaseClient.from('announcements').insert({
                user_id: userId,
                title: title,
                message: body,
                type: 'info',
                is_active: true,
                created_at: new Date().toISOString()
            })

            // 3. SEND PUSH
            const { data: devices } = await supabaseClient.from('user_devices').select('fcm_token').eq('user_id', userId)
            if (devices && devices.length > 0) {
                const tokens = devices.map(d => d.fcm_token)
                await admin.messaging().sendEachForMulticast({
                    notification: { title, body },
                    tokens: tokens,
                })
            }
        }

        return new Response(JSON.stringify({ message: `Reminders sent to ${uniqueUserIds.length} users` }), { status: 200 })

    } catch (err: any) {
        console.error("Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
})
