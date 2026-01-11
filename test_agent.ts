
import { createClient } from 'npm:@supabase/supabase-js@2'

// MOCK DATA for Testing
const mockProfile = { first_name: 'Franco' };
const mockGoals = [{ title: 'Vacaciones', target: 1000000, current: 400000 }];
const mockTransactions = [
    { date: '2024-01-08', title: 'Corte Degradado', type: 'income', amount: 15000, category: 'Servicio' },
    { date: '2024-01-08', title: 'Perfilado Barba', type: 'income', amount: 8000, category: 'Servicio' },
    { date: '2024-01-07', title: 'Compra Cervezas', type: 'expense', amount: 5000, category: 'Insumos' },
    { date: '2024-01-06', title: 'Corte Niño', type: 'income', amount: 10000, category: 'Servicio' }
];

const GEMINI_API_KEY = "AIzaSyC2AQGyR2bFgWimXD6OPtUMnW-fn7toJ0k";
const GEMINI_MODEL = "gemini-flash-latest";

async function testAgent(query: string, history: any[] = []) {
    console.log(`\n--- 🧪 PROBANDO AGENTE CON PREGUNTA: "${query}" ---`);

    // 1. Construct Context String (Same logic as Edge Function)
    const contextData = {
        userName: mockProfile.first_name,
        recentTransactions: mockTransactions.map(t => `${t.date}: ${t.title} (${t.type == 'income' ? 'Ingreso' : 'Gasto'}) - $${t.amount}`).join('\n')
    };

    const systemPrompt = `Eres "RegistBar AI", un agente financiero personal inteligente y empático.
    
    TUS DATOS:
    Usuario: ${contextData.userName}
    Metas: ${JSON.stringify(mockGoals)}
    Transacciones (Hasta 1000 registros):
    ${contextData.recentTransactions}

    TU PERSONALIDAD:
    1.  Eres conversacional e informal.
    2.  Usa emojis 💈💰.
    3.  Sé conciso.
    
    FORMATO:
    - Usa negritas (**texto**) para resaltar números.
    - Usa listas.
    
    MONEDA: Peso Chileno ($ CLP).`;

    // 2. Build Gemini Payload
    let contents = [];

    // Add History
    if (history.length > 0) {
        contents = history.map((msg: any) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.text }]
        }));
    }

    // Add Current Query
    contents.push({
        role: 'user',
        parts: [{ text: query }]
    });

    // Prepend System Prompt
    contents[0].parts[0].text = systemPrompt + "\n\n" + contents[0].parts[0].text;

    // 3. Call Gemini
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Error:", JSON.stringify(data));
            return;
        }

        const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log("\n🤖 RESPUESTA IA:");
        console.log(answer);
        console.log("\n--------------------------------------------------");
        return answer;

    } catch (e) {
        console.error("Error de Red:", e);
    }
}

// SIMULATE CONVERSATION FLOW
async function runSimulation() {
    // Turn 1
    const q1 = "Hola, ¿cómo estuvieron mis ingresos estos días?";
    const a1 = await testAgent(q1);

    // Turn 2 (Follow up with context)
    const q2 = "¿Y cuánto gasté?";
    // Pass history
    const history = [
        { role: 'user', text: q1 },
        { role: 'assistant', text: a1 }
    ];
    await testAgent(q2, history);
}

runSimulation();
