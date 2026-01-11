
async function listModels() {
    const GEMINI_API_KEY = "AIzaSyC2AQGyR2bFgWimXD6OPtUMnW-fn7toJ0k";
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log("Status:", response.status);
        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => console.log(`- ${m.name}`));
        } else {
            console.log("Response:", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

listModels();
