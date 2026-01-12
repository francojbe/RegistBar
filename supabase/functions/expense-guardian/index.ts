import { createClient } from 'jsr:@supabase/supabase-js@2'
import admin from 'firebase-admin'
const firebaseConfig = JSON.parse(Deno.env.get('FIREBASE_CONFIG') || '{}');

console.log("Expense Guardian Check Started (Variable Version)");

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

        // 2. Logic: Expense Check
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const { data: transactions } = await supabaseClient
            .from('transactions')
            .select('user_id, category, amount, commission_amount')
            .gte('date', oneWeekAgo.toISOString())

        const userStats: any = {};
        transactions?.forEach(t => {
            if (!userStats[t.user_id]) userStats[t.user_id] = { income: 0, supply: 0 };
            const val = t.commission_amount || t.amount || 0;
            if (t.category === 'supply') userStats[t.user_id].supply += Math.abs(val);
            else if (t.category === 'service') userStats[t.user_id].income += val;
        });

        for (const userId of uniqueUserIds) {
            const stats = userStats[userId] || { income: 0, supply: 0 };

            // If expenses > 30% of income, alert
            if (stats.supply > 0 && stats.supply > (stats.income * 0.3)) {
                const title = "🛡️ Guardián de Gastos";
                const body = "Tus gastos en insumos esta semana superan el 30% de tus ingresos. ¡Ojo con el presupuesto!";

                // 3. PERSISTENCE
                await supabaseClient.from('announcements').insert({
                    user_id: userId,
                    title: title,
                    message: body,
                    type: 'warning',
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
        }

        return new Response(JSON.stringify({ message: 'Guardian check complete' }))

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
})
