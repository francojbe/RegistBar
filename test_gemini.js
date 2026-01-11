
async function testGemini() {
    const GEMINI_API_KEY = "AIzaSyC2AQGyR2bFgWimXD6OPtUMnW-fn7toJ0k";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const body = {
        contents: [{
            parts: [{ text: "Hello, are you working?" }]
        }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        console.log("Status:", response.status);
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

testGemini();
