import { createClient } from 'jsr:@supabase/supabase-js@2'

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configuration for multiple providers
// Groq is prioritized after Gemini Preview. Cerebras is experimental fallback.
const MODEL_CONFIG = [
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'gemini', model: 'gemini-3-flash-preview' },
    { provider: 'gemini', model: 'gemini-2.5-flash-lite' },
    { provider: 'cerebras', model: 'llama3.1-8b' }
];

const TOOLS_DEF = [
    {
        name: "get_financial_summary",
        description: "Obtiene balance financiero, TOTALES DE GASTOS, desglose de servicios y detalle de en qué se gastó.",
        parameters: {
            type: "object",
            properties: {
                period: {
                    type: "string",
                    enum: ["today", "yesterday", "this_week", "this_month", "last_month", "this_year", "custom", "specific_week"],
                    description: "Periodo de tiempo. Usa 'custom' para meses específicos del pasado (ej: Noviembre)."
                },
                month: { type: "integer", description: "Mes del 1 al 12 (Solo si period es 'custom' o 'specific_week')" },
                year: { type: "integer", description: "Año completo ej: 2025 (Solo si period es 'custom')" },
                week_number: { type: "integer", description: "Número de semana (1 a 5) si es specific_week" }
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

// Helper to adapt tools for OpenAI format (Groq/Cerebras)
const getOpenAITools = () => {
    return TOOLS_DEF.map(t => ({
        type: "function",
        function: t
    }));
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { query, history } = await req.json();
        const authHeader = req.headers.get('Authorization');

        // Client for User interactions (RLS applied)
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { global: { headers: { Authorization: authHeader ?? '' } } }
        )

        // Client for Admin tasks (Secrets fetching) - No Auth Header override
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { data: { user } } = await supabaseClient.auth.getUser()
        if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        // --- Tool Execution Logic ---
        const executeTool = async (name: string, args: any) => {
            console.log(`[EXEC] ${name}`, args);
            // Added 'category' to select
            let q = supabaseClient.from('transactions').select('amount, type, title, category, date').eq('user_id', user.id);

            if (name === "get_financial_summary") {
                // Dynamic Date Helpers (Chile Time estimation)
                const getChileDate = (offsetDays = 0) => {
                    const d = new Date();
                    d.setHours(d.getHours() - 3); // Shift UTC to ~Chile
                    d.setDate(d.getDate() + offsetDays);
                    return d.toISOString().split('T')[0];
                };

                if (args.period === "today") {
                    const todayStr = getChileDate(0);
                    q = q.gte('date', `${todayStr}T00:00:00-03:00`).lte('date', `${todayStr}T23:59:59-03:00`);
                } else if (args.period === "yesterday") {
                    const yestStr = getChileDate(-1);
                    q = q.gte('date', `${yestStr}T00:00:00-03:00`).lte('date', `${yestStr}T23:59:59-03:00`);
                } else if (args.period === "last_month") {
                    const d = new Date();
                    d.setMonth(d.getMonth() - 1);
                    const y = d.getFullYear();
                    const m = d.getMonth() + 1;
                    const lastDay = new Date(y, m, 0).getDate();
                    q = q.gte('date', `${y}-${String(m).padStart(2, '0')}-01T00:00:00-03:00`)
                        .lte('date', `${y}-${String(m).padStart(2, '0')}-${lastDay}T23:59:59-03:00`);
                } else if (args.period === "this_month") {
                    const d = new Date();
                    const y = d.getFullYear();
                    const m = d.getMonth() + 1;
                    const lastDay = new Date(y, m + 1, 0).getDate();
                    q = q.gte('date', `${y}-${String(m).padStart(2, '0')}-01T00:00:00-03:00`)
                        .lte('date', `${y}-${String(m).padStart(2, '0')}-${lastDay}T23:59:59-03:00`);
                } else if (args.period === "this_week") {
                    const d = new Date();
                    const day = d.getDay() || 7;
                    if (day !== 1) d.setHours(-24 * (day - 1));
                    const mondayStr = d.toISOString().split('T')[0];
                    const end = new Date(d);
                    end.setDate(end.getDate() + 6);
                    const sundayStr = end.toISOString().split('T')[0];
                    q = q.gte('date', `${mondayStr}T00:00:00-03:00`).lte('date', `${sundayStr}T23:59:59-03:00`);
                } else if (args.period === "specific_week" && args.week_number) {
                    const y = args.year || new Date().getFullYear();
                    const m = args.month || 1;
                    const startDay = ((args.week_number - 1) * 7) + 1;
                    const endDay = args.week_number === 5 ? new Date(y, m, 0).getDate() : startDay + 6;
                    const start = `${y}-${String(m).padStart(2, '0')}-${String(startDay).padStart(2, '0')}T00:00:00-03:00`;
                    const end = `${y}-${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}T23:59:59-03:00`;
                    q = q.gte('date', start).lte('date', end);
                } else if (args.period === "custom") {
                    let y = args.year || new Date().getFullYear();
                    let m = args.month;
                    // Auto-fix for common errors
                    if (!m) { m = new Date().getMonth() + 1; }

                    const lastDay = new Date(y, m, 0).getDate();
                    const start = `${y}-${String(m).padStart(2, '0')}-01T00:00:00-03:00`;
                    const end = `${y}-${String(m).padStart(2, '0')}-${lastDay}T23:59:59-03:00`;
                    q = q.gte('date', start).lte('date', end);
                } else if (args.period === "this_year") {
                    const y = new Date().getFullYear();
                    const start = `${y}-01-01T00:00:00-03:00`;
                    const end = `${y}-12-31T23:59:59-03:00`;
                    q = q.gte('date', start).lte('date', end);
                }

                const { data } = await q;

                // Fetch User Profile & Goals
                const { data: profile } = await supabaseClient.from('profiles').select('first_name').eq('id', user.id).single();
                const { data: goals } = await supabaseClient.from('goals').select('title, target_amount, current_amount, deadline').eq('user_id', user.id); // Simple fetch all for now

                const user_name = profile?.first_name || "Usuario";
                const goals_text = goals?.map(g => `- ${g.title}: $${g.current_amount || 0} / $${g.target_amount} (Vence: ${g.deadline})`).join("\n") || "Sin metas activas.";

                // Basic Totals
                const income_txs = data?.filter(t => t.type === 'income') || [];
                const inc = income_txs.reduce((s, t) => s + (t.amount || 0), 0) || 0;
                const exp = data?.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount || 0), 0) || 0;
                const avg_ticket = income_txs.length > 0 ? Math.round(inc / income_txs.length) : 0;

                const day_map = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                const day_counts: Record<string, number> = {};
                income_txs.forEach(t => {
                    const d = new Date(t.date);
                    day_counts[day_map[d.getDay()]] = (day_counts[day_map[d.getDay()]] || 0) + (t.amount || 0);
                });

                const best_day_entry = Object.entries(day_counts).sort(([, a], [, b]) => b - a)[0];
                const best_day_text = best_day_entry ? `${best_day_entry[0]} ($${best_day_entry[1]})` : "No hay datos suficientes";

                // 3. Breakdown by category (Expenses)
                const breakdown: Record<string, number> = {};
                data?.filter(t => t.type === 'expense').forEach(t => { const key = t.title || t.category || "Varios"; breakdown[key] = (breakdown[key] || 0) + Math.abs(t.amount || 0); });
                const top_expenses_text = Object.entries(breakdown).sort(([, a], [, b]) => b - a).slice(0, 15).map(([k, v]) => `- ${k}: $${v}`).join("\n");

                // 4. Full Service Metrics (Merged Income & Frequency)
                const service_metrics: Record<string, { count: number, income: number }> = {};

                income_txs.forEach(t => {
                    const key = t.title || "Servicio General";
                    if (!key.toLowerCase().includes('propina')) {
                        if (!service_metrics[key]) service_metrics[key] = { count: 0, income: 0 };
                        service_metrics[key].count += 1;
                        service_metrics[key].income += (t.amount || 0);
                    }
                });

                // Convert to array and sort by Income descending
                const all_services_metrics = Object.entries(service_metrics)
                    .map(([name, m]) => ({ name, count: m.count, income: m.income, avg: Math.round(m.income / m.count) }))
                    .sort((a, b) => b.income - a.income);

                // Legacy text fields (kept for backward compat or quick summary, but full list is preferred)
                const top_services_text = all_services_metrics.slice(0, 10).map(s => `- ${s.name}: ${s.count} veces`).join("\n");
                const top_services_income_text = all_services_metrics.slice(0, 10).map(s => `- ${s.name}: $${s.income}`).join("\n");

                const lowest_income = all_services_metrics.length > 0 ? all_services_metrics[all_services_metrics.length - 1] : null;
                const low_income_text = lowest_income ? `${lowest_income.name} ($${lowest_income.income})` : "N/A";

                // Calculate Tips (Propinas)
                const total_tips = data?.reduce((acc, t) => {
                    const isTip = (t.title && t.title.toLowerCase().includes('propina')) || (t.category && t.category.toLowerCase().includes('propina'));
                    return acc + (isTip ? (t.amount || 0) : 0);
                }, 0) || 0;

                return {
                    user_name,
                    goals_text,
                    income: inc, expense: exp, balance: inc - exp, avg_ticket, best_day: best_day_text, count: data?.length || 0,
                    top_expenses_text,
                    total_tips: total_tips,
                    all_services_metrics: JSON.stringify(all_services_metrics),
                    lowest_income_service: low_income_text,
                    is_real_data: true,
                    period: args.period,
                    target_month: args.month || null,
                    target_year: args.year || null
                };
            }
            if (name === "search_transactions") {
                const { data } = await q.ilike('title', `%${args.query}%`).order('date', { ascending: false }).limit(20);
                return { transactions: data || [], is_real_data: true };
            }
            return { error: "Unknown" };
        };

        // --- Provider Calling Logic ---

        const systemPrompt = `Eres el ASESOR REGISTBAR 🇨🇱.
        FECHA ACTUAL: 11 de Enero de 2026.
        1. REGLA DE MESES: Si preguntan por un mes específico (ej: Noviembre), usa la herramienta con period='custom', month=11, year=2025.
        2. NATURALIDAD: Habla fluido con modismos chilenos sutiles.
        3. FOCO EN DATOS: Usa los números exactos de la herramienta.
        4. BREVEDAD: Ve directo al grano.
        5. ANTI-ALUCINACIÓN: Si no hay datos, di simplemente que no tienes registros para ese periodo. No menciones nombres técnicos de variables.`;

        let lastError = null;
        let successfulModel = "";

        for (const config of MODEL_CONFIG) {
            try {
                console.log(`Trying provider: ${config.provider} (${config.model})`);

                let result = null;
                let toolCall = null;
                let toolRes = null;
                const geminiKey = "AIzaSyAxxE-YSEoZ0gX9Rs3rGP_EnGQRFYl2TCA";

                // Fetch keys from DB using ADMIN client
                let groqKey = "";
                let cerebrasKey = "";

                if (config.provider === 'groq' || config.provider === 'cerebras') {
                    const { data: secrets } = await supabaseAdmin.from('app_config').select('key, value').in('key', ['GROQ_API_KEY', 'CEREBRAS_API_KEY']);
                    if (secrets) {
                        groqKey = secrets.find(s => s.key === 'GROQ_API_KEY')?.value || "";
                        cerebrasKey = secrets.find(s => s.key === 'CEREBRAS_API_KEY')?.value || "";
                    }
                }

                if (config.provider === 'gemini') {
                    // Gemini Payload
                    const messages = [];
                    if (history?.length) history.forEach((m: any) => messages.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] }));
                    else messages.push({ role: 'user', parts: [{ text: query }] });

                    const payload = { system_instruction: { parts: [{ text: systemPrompt }] }, contents: messages, tools: [{ function_declarations: TOOLS_DEF }] };
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${geminiKey}`;
                    const resp = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
                    if (!resp.ok) throw new Error(`Gemini ${resp.status}`);
                    const data = await resp.json();
                    const part = data.candidates?.[0]?.content?.parts?.[0];

                    if (part?.functionCall) {
                        toolCall = { name: part.functionCall.name, args: part.functionCall.args };
                    } else {
                        result = part?.text;
                    }

                } else if (config.provider === 'groq' || config.provider === 'cerebras') {
                    const apiKey = config.provider === 'groq' ? groqKey : cerebrasKey;
                    if (!apiKey) { console.log(`Skipping ${config.provider} (no key in DB)`); continue; }

                    const url = config.provider === 'groq' ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.cerebras.ai/v1/chat/completions";

                    const messages = [{ role: "system", content: systemPrompt }];
                    if (history?.length) history.forEach((m: any) => messages.push({ role: m.role, content: m.text }));
                    else messages.push({ role: 'user', content: query });

                    const payload = { model: config.model, messages: messages, tools: getOpenAITools(), tool_choice: "auto" };
                    const resp = await fetch(url, { method: 'POST', headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });

                    if (!resp.ok) {
                        const errTxt = await resp.text();
                        throw new Error(`${config.provider} ${resp.status}: ${errTxt}`);
                    }

                    const data = await resp.json();
                    const msg = data.choices[0].message;
                    if (msg.tool_calls) {
                        toolCall = { name: msg.tool_calls[0].function.name, args: JSON.parse(msg.tool_calls[0].function.arguments) };
                    } else {
                        result = msg.content;
                    }
                }

                // Handle Tool Call if present
                if (toolCall) {
                    toolRes = await executeTool(toolCall.name, toolCall.args);

                    // Second Turn 
                    const finalPrompt = `CONTEXTO: El usuario preguntó "${query}". 
                    DATOS OBTENIDOS: ${JSON.stringify(toolRes)}. 
                    INSTRUCCIÓN: Responde de forma natural basándote exclusivamente en estos datos. No menciones nombres técnicos de periodos.`;

                    if (config.provider === 'gemini') {
                        const url2 = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${geminiKey}`;
                        const resp2 = await fetch(url2, { method: 'POST', body: JSON.stringify({ system_instruction: { parts: [{ text: systemPrompt }] }, contents: [{ role: 'user', parts: [{ text: finalPrompt }] }] }) });
                        if (resp2.ok) {
                            const data2 = await resp2.json();
                            result = data2.candidates?.[0]?.content?.parts?.[0]?.text;
                        }
                    } else {
                        const apiKey = config.provider === 'groq' ? groqKey : cerebrasKey;
                        const url = config.provider === 'groq' ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.cerebras.ai/v1/chat/completions";
                        const resp2 = await fetch(url, { method: 'POST', headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: config.model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: finalPrompt }] }) });
                        if (resp2.ok) {
                            const data2 = await resp2.json();
                            result = data2.choices[0].message.content;
                        }
                    }
                }

                if (result) {
                    successfulModel = `${config.provider}/${config.model}`;
                    // LOGGING to DB (SILENT)
                    try {
                        await supabaseAdmin.from('chat_logs').insert({
                            user_id: user.id,
                            query: query,
                            response: result,
                            provider: config.provider,
                            model: config.model,
                            context_data: toolCall ? toolRes : null
                        });
                    } catch (logErr) { console.error("Log failed", logErr); }

                    return new Response(JSON.stringify({ answer: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }

            } catch (e) {
                console.warn(`Provider ${config.provider} failed:`, e);
                lastError = e.message;
            }
        }

        if (lastError) {
            // Log the failure to DB so we can debug
            try {
                await supabaseAdmin.from('chat_logs').insert({
                    user_id: user.id,
                    query: query,
                    response: `⚠️ SYSTEM ERROR: ${lastError}`,
                    provider: "system",
                    model: "error-catcher",
                    context_data: { error: lastError }
                });
            } catch (err) { console.error("Final log failed", err) }
        }

        return new Response(JSON.stringify({ answer: `⚠️ Error en todos los modelos. Último: ${lastError}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
})
