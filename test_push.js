
const https = require('https');

const data = JSON.stringify({
    userId: "3e94240f-c87f-4d3d-9b65-3fbc3f85ed96",
    title: "Prueba de Backend",
    body: "¡Funciona! Esta notificación vino desde Supabase 🚀"
});

const options = {
    hostname: 'pszkcntmkvtylvwnuflg.supabase.co',
    path: '/functions/v1/send-push',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzemtjbnRta3Z0eWx2d251ZmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MjYxNTEsImV4cCI6MjA4MTUwMjE1MX0.Jf-3hCeJWKaVWAKsrfezg9Ak07wrl9YqRs4-kztWEMo',
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
