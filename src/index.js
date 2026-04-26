require('dotenv').config();
const { MongoClient } = require('mongodb');
const TradingEngine = require('./tradingEngine');
const TradeEvaluator = require('./tradeEvaluator');
const kite = require('./kiteService');
const cron = require('node-cron');
const { spawn } = require('child_process');

async function runLoginAutomation() {
    console.log('🤖 Running Daily Login Automation...');
    return new Promise((resolve) => {
        const child = spawn('node', ['src/automateLogin.js']);
        child.stdout.on('data', (data) => console.log(`[Auth]: ${data}`));
        child.stderr.on('data', (data) => console.error(`[Auth-Error]: ${data}`));
        child.on('close', resolve);
    });
}

let sentSymbols = new Set();

async function bootstrap() {
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
            }
        }
    }, 5 * 60 * 1000); // Scan every 5 minutes

    console.log('🚀 Trading System is Live.');
}

bootstrap().catch(console.error);
