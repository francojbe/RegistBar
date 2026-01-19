import https from 'https';

const PROJECT_REF = 'pdtjcemyrdwolgqlvxew';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

// SQL simplificado en una sola línea para evitar problemas de JSON
const sqlQuery = `
CREATE TABLE IF NOT EXISTS public.app_version_control ( id UUID DEFAULT gen_random_uuid() PRIMARY KEY, platform TEXT NOT NULL, min_version_code INTEGER DEFAULT 1, latest_version_code INTEGER DEFAULT 1, force_update BOOLEAN DEFAULT false, update_message TEXT DEFAULT 'Nueva versión disponible', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(platform) );
ALTER TABLE public.app_version_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON public.app_version_control FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Service role write access" ON public.app_version_control FOR ALL TO service_role USING (true);
INSERT INTO public.app_version_control (platform, min_version_code, latest_version_code, force_update, update_message) VALUES ('android', 8, 8, false, 'Actualiza para disfrutar de lo último.') ON CONFLICT (platform) DO NOTHING;
`;

const data = JSON.stringify({
    query: sqlQuery
});

const options = {
    hostname: 'api.supabase.com',
    port: 443,
    path: `/v1/projects/${PROJECT_REF}/database/query`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Length': Buffer.byteLength(data)
    }
};

console.log(`Ejecutando SQL en el proyecto ${PROJECT_REF}...`);

const req = https.request(options, (res) => {
    let responseBody = '';

    res.on('data', (chunk) => {
        responseBody += chunk;
    });

    res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ SQL ejecutado exitosamente.');
            console.log('Respuesta:', responseBody);
        } else {
            console.error(`❌ Error al ejecutar SQL (Status: ${res.statusCode})`);
            console.error('Detalles:', responseBody);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Error de conexión:', error);
});

req.write(data);
req.end();
