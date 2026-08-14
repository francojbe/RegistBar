import { createClient } from 'jsr:@supabase/supabase-js@2'

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OCR_SYSTEM_PROMPT = `Eres un sistema experto de OCR y análisis financiero chileno 🇨🇱 para la aplicación RegistBar (Barberías y Salones).
Tu objetivo es analizar la imagen recibida (boleta, factura, voucher POS de Transbank/SumUp, o COMPROBANTE DE TRANSFERENCIA BANCARIA chilena de BancoEstado/CuentaRUT, Banco de Chile, Santander, MACH, Tenpo, Bci, etc.) y extraer con máxima precisión los datos financieros.

Debes responder ÚNICAMENTE con un objeto JSON válido con los siguientes campos:

{
  "monto_total": (Number) Monto final sin puntos ni signos (ej: 15000, 25990). Si no se detecta, null.
  "nombre_comercio": (String) Nombre del comercio, tienda, empresa proveedora, o nombre del destinatario/emisor de la transferencia.
  "rut_emisor": (String) RUT chileno si aparece en el comprobante (formato XX.XXX.XXX-X). Si no aparece, null.
  "fecha_gasto": (String) Fecha en formato ISO internacional YYYY-MM-DD (ej: 2026-08-14). Si no aparece, usa la fecha actual.
  "tipo_documento": (String) "transferencia" | "boleta" | "voucher" | "factura" | "otro"
  "categoria_sugerida": (String) "supply" (insumos como cuchillas, pomadas, champú, toallas) | "equipment" (máquinas de corte, patilleras, sillón) | "rent" (arriendo de local o sillón) | "service" (pago por corte/servicio de cliente) | "other" (varios)
  "tipo_transaccion": (String) "expense" (para compras de insumos, arriendos, pagos a terceros) o "income" (para transferencias que correspondan a un pago recibido de un cliente por un servicio)
}

REGLAS ESTRICTAS:
1. Responde EXCLUSIVAMENTE con el JSON plano sin etiquetas Markdown ni texto adicional.
2. Limpia los montos de cualquier símbolo ($ o CLP) y entrega solo números enteros.
3. Para fechas, convierte formatos comunes chilenos (DD/MM/AAAA, DD-MM-AA, "14 de Agosto") a YYYY-MM-DD.`;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { image } = await req.json();
        if (!image) {
            return new Response(JSON.stringify({ error: 'No image data provided' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const authHeader = req.headers.get('Authorization');
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Fetch Groq API Key from database
        const { data: configData } = await supabaseAdmin
            .from('app_config')
            .select('value')
            .eq('key', 'GROQ_API_KEY')
            .single();

        const groqKey = configData?.value || Deno.env.get('GROQ_API_KEY');
        if (!groqKey) {
            throw new Error('GROQ_API_KEY is not configured in app_config.');
        }

        // Ensure base64 string has the data URL prefix for Groq
        const formattedImageUrl = image.startsWith('data:image')
            ? image
            : `data:image/jpeg;base64,${image}`;

        const payload = {
            model: "llama-3.2-11b-vision-preview",
            messages: [
                { role: "system", content: OCR_SYSTEM_PROMPT },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Analiza este comprobante o transferencia y extrae todos los datos estructurados en JSON:" },
                        {
                            type: "image_url",
                            image_url: { url: formattedImageUrl }
                        }
                    ]
                }
            ],
            temperature: 0.1,
            max_tokens: 600,
            response_format: { type: "json_object" }
        };

        console.log('[SCAN] Calling Groq Vision API...');
        const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${groqKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            const errText = await resp.text();
            console.error('[SCAN] Groq Vision Error:', errText);
            throw new Error(`Groq Vision Error: ${errText}`);
        }

        const data = await resp.json();
        const rawContent = data.choices?.[0]?.message?.content || '{}';
        
        let parsedResult: any = {};
        try {
            parsedResult = JSON.parse(rawContent);
        } catch {
            // Clean up any extra wrapper markdown if present
            const cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedResult = JSON.parse(cleanJson);
        }

        console.log('[SCAN] Extracted Data:', parsedResult);

        return new Response(JSON.stringify(parsedResult), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('[SCAN] Error processing image:', err);
        return new Response(JSON.stringify({ error: err.message || 'Error al procesar la imagen' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
