import { createClient } from 'jsr:@supabase/supabase-js@2'
import admin from 'firebase-admin'
const firebaseConfig = JSON.parse(Deno.env.get('FIREBASE_CONFIG') || '{}');

console.log("Weekly Summary Started (Variable Version)");

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
        const userIds = [...new Set(users?.map(u => u.user_id))];

        if (!userIds.length) return new Response(JSON.stringify({ message: 'No users' }))

        // 2. Calculate Weekly Income
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const { data: transactions } = await supabaseClient
            .from('transactions')
            .select('user_id, commission_amount, amount')
            .gte('date', oneWeekAgo.toISOString())

        const userIncome: any = {};
        transactions?.forEach(t => {
            const val = t.commission_amount || t.amount || 0;
            userIncome[t.user_id] = (userIncome[t.user_id] || 0) + val;
        });

        for (const userId of userIds) {
            const income = userIncome[userId] || 0;
            if (income === 0) continue;

            const title = "🔥 Resumen Semanal";
            const body = `Esta semana generaste $${income.toLocaleString('es-CL')}. ¡Tremendo trabajo!`;

            // 3. PERSISTENCE
            await supabaseClient.from('announcements').insert({
                user_id: userId,
                title: title,
                message: body,
                type: 'success',
                is_active: true,
                created_at: new Date().toISOString()
            })

            // 4. SEND PUSH
            const { data: devices } = await supabaseClient.from('user_devices').select('fcm_token').eq('user_id', userId)
            if (devices && devices.length > 0) {
                const tokens = devices.map(d => d.fcm_token)
                await admin.messaging().sendEachForMulticast({
                    notification: { title, body },
                    tokens: tokens,
                })
            }
        }

        return new Response(JSON.stringify({ message: 'Weekly summaries processed' }))

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
})
