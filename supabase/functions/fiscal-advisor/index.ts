import { createClient } from 'jsr:@supabase/supabase-js@2'

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TOOLS_DEF = [
    {
        name: "get_financial_summary",
        description: "Obtiene balance financiero, TOTALES DE GASTOS, desglose de servicios y detalle de en qué se gastó.",
        parameters: {
            type: "object",
            properties: {
                period: {
                    type: "string",
                    enum: ["today", "yesterday", "this_week", "this_month", "last_month", "this_year", "last_year", "custom"],
                    description: "Periodo de tiempo."
                },
                month: { type: "integer", description: "Mes del 1 al 12" },
                year: { type: "integer", description: "Año completo" }
            },
            required: ["period"]
        }
    },
    {
        name: "search_transactions",
        description: "Busca transacciones específicas por texto.",
        parameters: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"]
        }
    }
];

const getChileTime = () => {
    const now = new Date();
    return new Intl.DateTimeFormat('es-CL', {
        timeZone: 'America/Santiago',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(now);
};

const systemPrompt = `Eres el ASESOR REGISTBAR 🇨🇱. Socio estratégico de Franco para su barbería.
FECHA ACTUAL: ${getChileTime()}.

REGLAS DE ORO DE ENTRENAMIENTO (BASADO EN AUDITORÍA DE 20 ÚLTIMOS LOGS):

1. PROHIBICIÓN TOTAL DE ALUCINACIÓN:
   - ERROR DETECTADO: Inventaste que Octubre 2024 fue el peor mes con $18.450 y que un finde generó $253.100.
   - MANDATO: Si 'context_data' NO tiene el desglose diario (solo tiene totales), di: "Franco, tengo el total del periodo (**$X**), pero no tengo el detalle día por día para decirte cuál fue el exacto peor o mejor". NUNCA INVENTES CIFRAS.

2. LÓGICA DE HERRAMIENTAS:
   - Si piden "Mejor/Peor", "Diferencia" o "Comparación", USA 'get_financial_summary'.
   - Si la herramienta falla o no devuelve datos, di: "No tengo registros suficientes para comparar".

3. MANEJO DE HISTORIAL:
   - No repitas el JSON de la herramienta en tu respuesta de texto.
   - Responde con naturalidad, usando el formato "Punto Medio":
     * Saludo breve.
     * Datos claves en **negritas**.
     * Un consejo de negocio basado en la meta (Vacaciones 2026).

4. FILTRO DE AÑO (2026 vs 2025):
   - "Este año" es exclusivamente desde el 1 de enero de 2026.
   - "El año pasado" es 2025.

REGLA DE SEGURIDAD: Prefiero que digas "No lo sé" a que mientas sobre las finanzas de Franco.`;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { query, history } = await req.json();
        const authHeader = req.headers.get('Authorization');

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { global: { headers: { Authorization: authHeader ?? '' } } }
        )

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { data: { user } } = await supabaseClient.auth.getUser()
        if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        const executeTool = async (name: string, args: any) => {
            console.log(`[EXEC] ${name}`, args);
            let q = supabaseClient.from('transactions').select('amount, type, title, category, date').eq('user_id', user.id);

            if (name === "get_financial_summary") {
                const getChileDateStr = (offsetDays = 0) => {
                    const d = new Date();
                    d.setHours(d.getHours() - 3);
                    d.setDate(d.getDate() + offsetDays);
                    return d.toISOString().split('T')[0];
                };

                const currentYear = new Date().getFullYear();

                if (args.period === "today") {
                    const todayStr = getChileDateStr(0);
                    q = q.gte('date', `${todayStr}T00:00:00-03:00`).lte('date', `${todayStr}T23:59:59-03:00`);
                } else if (args.period === "yesterday") {
                    const yestStr = getChileDateStr(-1);
                    q = q.gte('date', `${yestStr}T00:00:00-03:00`).lte('date', `${yestStr}T23:59:59-03:00`);
                } else if (args.period === "this_week") {
                    const d = new Date();
                    const day = d.getDay() || 7;
                    if (day !== 1) d.setDate(d.getDate() - (day - 1));
                    const mondayStr = d.toISOString().split('T')[0];
                    const end = new Date(d);
                    end.setDate(end.getDate() + 6);
                    const sundayStr = end.toISOString().split('T')[0];
                    q = q.gte('date', `${mondayStr}T00:00:00-03:00`).lte('date', `${sundayStr}T23:59:59-03:00`);
                } else if (args.period === "this_month") {
                    const d = new Date();
                    const y = d.getFullYear();
                    const m = d.getMonth() + 1;
                    const lastDay = new Date(y, m, 0).getDate();
                    q = q.gte('date', `${y}-${String(m).padStart(2, '0')}-01T00:00:00-03:00`).lte('date', `${y}-${String(m).padStart(2, '0')}-${lastDay}T23:59:59-03:00`);
                } else if (args.period === "last_month") {
                    const d = new Date();
                    d.setMonth(d.getMonth() - 1);
                    const y = d.getFullYear();
                    const m = d.getMonth() + 1;
                    const lastDay = new Date(y, m, 0).getDate();
                    q = q.gte('date', `${y}-${String(m).padStart(2, '0')}-01T00:00:00-03:00`).lte('date', `${y}-${String(m).padStart(2, '0')}-${lastDay}T23:59:59-03:00`);
                } else if (args.period === "this_year") {
                    q = q.gte('date', `${currentYear}-01-01T00:00:00-03:00`).lte('date', `${currentYear}-12-31T23:59:59-03:00`);
                } else if (args.period === "last_year") {
                    const lastY = currentYear - 1;
                    q = q.gte('date', `${lastY}-01-01T00:00:00-03:00`).lte('date', `${lastY}-12-31T23:59:59-03:00`);
                } else if (args.period === "custom") {
                    let y = args.year || currentYear;
                    let m = args.month;
                    if (m) {
                        const lastDay = new Date(y, m, 0).getDate();
                        q = q.gte('date', `${y}-${String(m).padStart(2, '0')}-01T00:00:00-03:00`).lte('date', `${y}-${String(m).padStart(2, '0')}-${lastDay}T23:59:59-03:00`);
                    } else {
                        q = q.gte('date', `${y}-01-01T00:00:00-03:00`).lte('date', `${y}-12-31T23:59:59-03:00`);
                    }
                }

                const { data } = await q;
                const { data: profile } = await supabaseClient.from('profiles').select('first_name').eq('id', user.id).single();
                const { data: goals } = await supabaseClient.from('goals').select('title, target_amount, current_amount, deadline').eq('user_id', user.id);

                const income_txs = data?.filter(t => t.type === 'income') || [];
                const inc = income_txs.reduce((s, t) => s + (t.amount || 0), 0) || 0;
                const exp = data?.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount || 0), 0) || 0;

                const breakdown: Record<string, number> = {};
                data?.filter(t => t.type === 'expense').forEach(t => {
                    const key = t.title || t.category || "Varios";
                    breakdown[key] = (breakdown[key] || 0) + Math.abs(t.amount || 0);
                });

                const service_metrics: Record<string, { count: number, income: number }> = {};
                income_txs.forEach(t => {
                    const key = t.title || "Servicio General";
                    if (!key.toLowerCase().includes('propina')) {
                        if (!service_metrics[key]) service_metrics[key] = { count: 0, income: 0 };
                        service_metrics[key].count += 1;
                        service_metrics[key].income += (t.amount || 0);
                    }
                });

                return {
                    user_name: profile?.first_name || "Usuario",
                    goals_text: goals?.map(g => `- ${g.title}: $${g.current_amount || 0} / $${g.target_amount} (Vence: ${g.deadline})`).join("\n") || "Sin metas activas.",
                    income: inc, expense: exp, balance: inc - exp,
                    top_expenses_text: Object.entries(breakdown).sort(([, a], [, b]) => b - a).slice(0, 15).map(([k, v]) => `- ${k}: $${v}`).join("\n"),
                    all_services_metrics: JSON.stringify(Object.entries(service_metrics).map(([name, m]) => ({ name, count: m.count, income: m.income })).sort((a, b) => b.income - a.income)),
                    is_real_data: (data && data.length > 0) ? true : false,
                    period_requested: args.period
                };
            }
            if (name === "search_transactions") {
                const { data } = await q.ilike('title', `%${args.query}%`).order('date', { ascending: false }).limit(20);
                return { transactions: data || [], is_real_data: true };
            }
            return { error: "Unknown" };
        };

        const { data: secrets } = await supabaseAdmin.from('app_config').select('key, value').in('key', ['GROQ_API_KEY', 'CEREBRAS_API_KEY']);
        const groqKey = secrets?.find(s => s.key === 'GROQ_API_KEY')?.value || "";
        const cerebrasKey = secrets?.find(s => s.key === 'CEREBRAS_API_KEY')?.value || "";

        const providers = [
            { name: "groq", url: "https://api.groq.com/openai/v1/chat/completions", key: groqKey, model: "llama-3.3-70b-versatile" },
            { name: "cerebras", url: "https://api.cerebras.ai/v1/chat/completions", key: cerebrasKey, model: "llama3.1-8b" }
        ];

        const openAITools = TOOLS_DEF.map(t => ({ type: "function", function: t }));
        const messages = [{ role: "system", content: systemPrompt }];
        if (history?.length) history.forEach((m: any) => messages.push({ role: m.role, content: m.text }));
        messages.push({ role: "user", content: query });

        let resultText = "";
        let toolRes = null;
        let finalProvider = "";

        for (const provider of providers) {
            if (!provider.key) continue;
            try {
                console.log(`[TRY] ${provider.name}`);
                const resp = await fetch(provider.url, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${provider.key}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: provider.model,
                        messages: messages,
                        tools: openAITools,
                        tool_choice: "auto",
                        max_tokens: 500
                    })
                });

                if (!resp.ok) throw new Error(`${provider.name} Error: ${await resp.text()}`);
                const data = await resp.json();
                const msg = data.choices[0].message;

                if (msg.tool_calls) {
                    const toolCall = msg.tool_calls[0];
                    const name = toolCall.function.name;
                    const args = JSON.parse(toolCall.function.arguments);
                    toolRes = await executeTool(name, args);

                    const finalMessages = [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: query },
                        { role: "assistant", content: null, tool_calls: [toolCall] },
                        { role: "tool", tool_call_id: toolCall.id, name: name, content: JSON.stringify(toolRes) }
                    ];

                    const resp2 = await fetch(provider.url, {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${provider.key}`, "Content-Type": "application/json" },
                        body: JSON.stringify({ model: provider.model, messages: finalMessages, max_tokens: 500 })
                    });

                    if (!resp2.ok) throw new Error(`${provider.name} Second Pass Error: ${await resp2.text()}`);
                    const data2 = await resp2.json();
                    resultText = data2.choices[0].message.content;
                } else {
                    resultText = msg.content;
                }

                finalProvider = provider.name;
                break; // Exit loop on success
            } catch (e) {
                console.error(`[FAIL] ${provider.name}:`, e.message);
                continue; // Try next provider
            }
        }

        if (!resultText) throw new Error("All AI providers failed.");

        await supabaseAdmin.from('chat_logs').insert({
            user_id: user.id,
            query: query,
            response: resultText,
            provider: finalProvider,
            model: finalProvider === "groq" ? "llama-3.3-70b-versatile" : "llama3.1-8b",
            context_data: toolRes
        });

        return new Response(JSON.stringify({ answer: resultText }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
})
