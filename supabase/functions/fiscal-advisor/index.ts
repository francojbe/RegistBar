import { createClient } from 'jsr:@supabase/supabase-js@2'

const GEMINI_API_KEY = "AIzaSyC2AQGyR2bFgWimXD6OPtUMnW-fn7toJ0k";
const GEMINI_MODEL = "gemini-1.5-flash-latest";

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const tools = [
    {
        function_declarations: [
            {
                name: "get_financial_summary",
                description: "CONSULTA OBLIGATORIA para obtener totales de ingresos y gastos. Úsala siempre que el usuario pregunte por dinero, meses pasados o totales.",
                parameters: {
                    type: "object",
                    properties: {
                        period: { type: "string", enum: ["this_month", "last_month", "this_year", "total", "custom"] },
                        month: { type: "integer" },
                        year: { type: "integer" }
                    },
                    required: ["period"]
                }
            },
            {
                name: "search_transactions",
                description: "Busca detalles de transacciones específicas (nombres, fechas, montos individuales).",
                parameters: {
                    type: "object",
                    properties: {
                        query: { type: "string" },
                        startDate: { type: "string" },
                        endDate: { type: "string" }
                    }
                }
            }
        ]
    }
];

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

        const { data: { user } } = await supabaseClient.auth.getUser()
        if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

        const executeTool = async (name: string, args: any) => {
            console.log(`[EXEC] ${name}`, args);
            let q = supabaseClient.from('transactions').select('amount, type, title, date').eq('user_id', user.id);

            const now = new Date("2026-01-10T23:00:00Z"); // Fix point in time for the AI

            if (name === "get_financial_summary") {
                if (args.period === "last_month" || (args.month === 12 && args.year === 2025)) {
                    q = q.gte('date', '2025-12-01T00:00:00Z').lte('date', '2025-12-31T23:59:59Z');
                } else if (args.period === "this_month") {
                    q = q.gte('date', '2026-01-01T00:00:00Z');
                } else if (args.period === "custom" && args.month && args.year) {
                    const start = new Date(args.year, args.month - 1, 1).toISOString();
                    const end = new Date(args.year, args.month, 0, 23, 59, 59).toISOString();
                    q = q.gte('date', start).lte('date', end);
                }

                const { data } = await q;
                const inc = data?.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0) || 0;
                const exp = data?.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount || 0), 0) || 0;
                return { income: inc, expense: exp, balance: inc - exp, count: data?.length || 0, is_real_data: true };
            }

            if (name === "search_transactions") {
                if (args.query) q = q.ilike('title', `%${args.query}%`);
                const { data } = await q.order('date', { ascending: false }).limit(20);
                return { transactions: data || [], is_real_data: true };
            }
            return { error: "Unknown" };
        }

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

        const contents = [];
        if (history && Array.isArray(history)) {
            history.forEach((msg: any) => {
                contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.text }] });
            });
        }
        contents.push({ role: 'user', parts: [{ text: query }] });

        const payload = {
            system_instruction: {
                parts: [{
                    text: `ERES ASESOR REGISTBAR. HOY ES 10 DE ENERO DE 2026.
        1. TIENES ACCESO A LA BASE DE DATOS REAL DEL USUARIO.
        2. SI PREGUNTAN POR DINERO, GASTOS O INGRESOS, USA 'get_financial_summary' O 'search_transactions'.
        3. ESTÁ PROHIBIDO DECIR "NO TENGO DATOS" SIN USAR UNA HERRAMIENTA.
        4. LOS DATOS SON REALES, NO SIMULADOS. SE BREVE.` }]
            },
            contents,
            tools
        };

        const r1 = await fetch(geminiUrl, { method: 'POST', body: JSON.stringify(payload) });
        const d1 = await r1.json();
        const p1 = d1.candidates?.[0]?.content?.parts?.[0];

        if (p1?.functionCall) {
            const toolRes = await executeTool(p1.functionCall.name, p1.functionCall.args);

            contents.push(d1.candidates[0].content);
            contents.push({
                role: 'function',
                parts: [{ functionResponse: { name: p1.functionCall.name, response: { content: toolRes } } }]
            });

            const r2 = await fetch(geminiUrl, { method: 'POST', body: JSON.stringify({ ...payload, contents }) });
            const d2 = await r2.json();
            return new Response(JSON.stringify({ answer: d2.candidates?.[0]?.content?.parts?.[0]?.text }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({ answer: p1?.text || "Hubo un problema. Intenta preguntar de nuevo." }), { headers: corsHeaders });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
})
