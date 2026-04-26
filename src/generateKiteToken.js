require('dotenv').config();
const KiteConnect = require("kiteconnect").KiteConnect;

async function generateToken() {
    const apiKey = process.env.KITE_API_KEY;
    const apiSecret = process.env.KITE_API_SECRET; // Ensure you add this to .env!
    const requestToken = process.argv[2];

    if (!requestToken) {
        console.log("❌ Error: Please provide the request_token from the URL.");
        console.log("Usage: node src/generateKiteToken.js YOUR_REQUEST_TOKEN");
        return;
    }

    const kc = new KiteConnect({ api_key: apiKey });

    try {
        const response = await kc.generateSession(requestToken, apiSecret);
        console.log("\n✅ SUCCESS!");
        console.log("-----------------------------------------");
        console.log("YOUR ACCESS TOKEN:");
        console.log(response.access_token);
        console.log("-----------------------------------------");
        console.log("Copy this into your .env file as KITE_ACCESS_TOKEN\n");
    } catch (err) {
        console.error("❌ Failed to generate session:", err.message);
    }
}

generateToken();
