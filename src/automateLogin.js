require('dotenv').config();
const puppeteer = require('puppeteer');
const { otplib } = require('otplib');
const axios = require('axios');
const KiteConnect = require("kiteconnect").KiteConnect;

async function updateRailwayVariable(newValue) {
    const { RAILWAY_API_KEY, RAILWAY_PROJECT_ID, RAILWAY_SERVICE_ID } = process.env;
    
    if (!RAILWAY_API_KEY || !RAILWAY_PROJECT_ID || !RAILWAY_SERVICE_ID) {
        console.warn("⚠️ Railway variables missing. Skipping auto-update.");
        return;
    }

    const query = `
        mutation variableUpsert($projectId: String!, $serviceId: String!, $name: String!, $value: String!) {
            variableUpsert(projectId: $projectId, serviceId: $serviceId, name: $name, value: $value)
        }
    `;

    try {
        await axios.post('https://backboard.railway.app/graphql/v2', {
            query,
            variables: {
                projectId: RAILWAY_PROJECT_ID,
                serviceId: RAILWAY_SERVICE_ID,
                name: 'KITE_ACCESS_TOKEN',
                value: newValue
            }
        }, {
            headers: { 'Authorization': `Bearer ${RAILWAY_API_KEY}` }
        });
        console.log("🚀 Railway KITE_ACCESS_TOKEN updated successfully!");
    } catch (err) {
        console.error("❌ Railway Update Failed:", err.response?.data || err.message);
    }
}

async function automate() {
    const { KITE_API_KEY, KITE_API_SECRET, KITE_USERNAME, KITE_PASSWORD, KITE_TOTP_SECRET } = process.env;

    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const page = await browser.newPage();
    const loginUrl = `https://kite.trade/connect/login?api_key=${KITE_API_KEY}&v=3`;

    try {
        console.log("🌐 Navigating to Kite...");
        await page.goto(loginUrl);
        await page.waitForSelector('#userid');
        await page.type('#userid', KITE_USERNAME);
        await page.type('#password', KITE_PASSWORD);
        await page.click('button[type="submit"]');

        console.log("🔐 Entering TOTP...");
        await page.waitForSelector('input[label="External TOTP"]');
        const token = otplib.authenticator.generate(KITE_TOTP_SECRET);
        await page.type('input[label="External TOTP"]', token);
        await page.click('button[type="submit"]');

        await page.waitForNavigation();
        const requestToken = new URL(page.url()).searchParams.get('request_token');

        if (requestToken) {
            const kc = new KiteConnect({ api_key: KITE_API_KEY });
            const session = await kc.generateSession(requestToken, KITE_API_SECRET);
            
            console.log("✅ New Token:", session.access_token);
            
            // 🔥 The "Fire and Forget" part:
            await updateRailwayVariable(session.access_token);
        }
    } catch (err) {
        console.error("❌ Automation Failed:", err.message);
    } finally {
        await browser.close();
    }
}

automate();
