require('dotenv').config();
const { MongoClient } = require('mongodb');
const TradingEngine = require('./tradingEngine');
const TradeEvaluator = require('./tradeEvaluator');
const kite = require('./kiteService');
const cron = require('node-cron');
const { spawn } = require('child_process');

let sentSymbols = new Set();
let isAuthenticating = false;

async function runLoginAutomation() {
    if (isAuthenticating) return;
    isAuthenticating = true;
    console.log('🤖 Running Daily Login Automation...');
    return new Promise((resolve) => {
        const child = spawn('node', ['src/automateLogin.js']);
        child.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`[Auth]: ${output}`);
            const match = output.match(/✅ New Token:\s*([A-Za-z0-9]+)/);
            if (match) {
                const token = match[1];
                kite.setAccessToken(token);
                console.log('🔑 Access token updated in memory.');
            }
        });
        child.stderr.on('data', (data) => console.error(`[Auth-Error]: ${data}`));
        child.on('close', () => {
            isAuthenticating = false;
            resolve();
        });
    });
}

async function bootstrap() {
    const required = ['MONGO_URI', 'KITE_API_KEY', 'KITE_API_SECRET', 'KITE_USERNAME', 'KITE_PASSWORD', 'KITE_TOTP_SECRET'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error(`❌ ERROR: Missing required variables: ${missing.join(', ')}`);
        console.error("Please add them in the Railway Variables tab.");
        process.exit(1);
    }

    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    console.log('✅ Database Connected');

    const engine = new TradingEngine(db);
    const evaluator = new TradeEvaluator(db);

    // 🕒 1. Daily Reset & Login (8:45 AM)
    cron.schedule('15 3 * * *', async () => {
        sentSymbols.clear(); // Reset sent symbols daily
        await runLoginAutomation();
    });

    // 🔄 2. Hourly Trade Evaluator (Profit/Loss Tracker)
    setInterval(async () => {
        try {
            await evaluator.runHourlyCheck();
        } catch (e) { console.error('Evaluator Error:', e.message); }
    }, 60 * 60 * 1000);

    // 📡 3. Continuous Scanner (High Frequency)
    const WATCHLIST = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'BAJFINANCE', 'ADANIENT', 'TITAN', 'LT', 'AXISBANK'];
    
    console.log('📡 Continuous Scanner Active...');

    setInterval(async () => {
        // Only scan during market hours (9:15 AM - 3:30 PM IST)
        const now = new Date();
        const hour = now.getUTCHours() + 5; // Simple IST conversion
        const minute = now.getUTCMinutes() + 30;
        const totalMinutes = hour * 60 + minute;

        if (totalMinutes < 555 || totalMinutes > 930) return; // Outside 9:15-15:30

        const trend = await kite.getNiftyTrend();
        if (!trend.isBullish) return;

        for (const symbol of WATCHLIST) {
            if (sentSymbols.has(symbol)) continue; // 🚫 Skip if already sent today

            try {
                const fullSymbol = `NSE:${symbol}`;
                const ltp = await kite.getLTP([fullSymbol]);
                const price = ltp[fullSymbol].last_price;
                
                const tradeData = {
                    symbol: symbol,
                    entryPrice: price,
                    targetPrice: price * 1.05,
                    stopLoss: price * 0.97,
                    score: 78, // Placeholder for rule-based engine
                    volumeRatio: 1.8,
                    indicators: {
                        rsi: 65,
                        ema20: price * 0.99,
                        ema50: price * 0.96,
                        macd: 1
                    }
                };

                const result = await engine.evaluateTrade(tradeData);
                
                // If the engine actually sent a signal, mark it as sent
                if (result && result.shouldExecute) {
                    sentSymbols.add(symbol);
                }
            } catch (e) {
                console.error(`Error scanning ${symbol}:`, e.message);
                if (e.message.includes('Incorrect `api_key` or `access_token`') || e.message.includes('Incorrect api_key or access_token')) {
                    if (!isAuthenticating) {
                        console.log('🔑 Token expired or invalid. Triggering login automation...');
                        runLoginAutomation().catch(console.error);
                    }
                }
            }
        }
    }, 5 * 60 * 1000); // Scan every 5 minutes

    console.log('🚀 Trading System is Live.');
}

bootstrap().catch(console.error);
