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

        // 2. Logic: Expense Check
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const { data: transactions } = await supabaseAdmin
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

            if (stats.supply > 0 && stats.supply > (stats.income * 0.3)) {
                const title = "🛡️ Guardián de Gastos";
                const body = "Tus gastos en insumos esta semana superan el 30% de tus ingresos. ¡Ojo con el presupuesto!";

                await supabaseAdmin.from('announcements').insert({
                    user_id: userId, title, message: body, type: 'warning', is_active: true, created_at: new Date().toISOString()
                })

                const { data: devices } = await supabaseAdmin.from('user_devices').select('fcm_token').eq('user_id', userId)
                if (devices && devices.length > 0) {
                    await admin.messaging().sendEachForMulticast({
                        notification: { title, body },
                        tokens: devices.map(d => d.fcm_token),
                    })
                }
            }
        }

        return new Response(JSON.stringify({ message: 'Guardian check complete' }))
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
})
