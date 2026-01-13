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
        const userIds = [...new Set(users?.map(u => u.user_id))];

        if (!userIds.length) return new Response(JSON.stringify({ message: 'No users' }))

        // 2. Calculate Weekly Income
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const { data: transactions } = await supabaseAdmin
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

            await supabaseAdmin.from('announcements').insert({
                user_id: userId, title, message: body, type: 'success', is_active: true, created_at: new Date().toISOString()
            })

            const { data: devices } = await supabaseAdmin.from('user_devices').select('fcm_token').eq('user_id', userId)
            if (devices && devices.length > 0) {
                await admin.messaging().sendEachForMulticast({
                    notification: { title, body },
                    tokens: devices.map(d => d.fcm_token)
                })
            }
        }

        return new Response(JSON.stringify({ message: 'Weekly summaries processed' }))
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
})
