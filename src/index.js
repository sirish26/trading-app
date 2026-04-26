require('dotenv').config();
const { MongoClient } = require('mongodb');
const TradingEngine = require('./tradingEngine');
const TradeEvaluator = require('./tradeEvaluator');
const kite = require('./kiteService');

async function bootstrap() {
    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    
    console.log('✅ Database Connected');

    const engine = new TradingEngine(db);
    const evaluator = new TradeEvaluator(db);

    // 1. Start the Hourly Evaluator
    console.log('🔄 Starting Trade Evaluator (Hourly)...');
    setInterval(async () => {
        try {
            await evaluator.runHourlyCheck();
            console.log('✅ Hourly Price Check Completed');
        } catch (e) {
            console.error('❌ Evaluator Error:', e.message);
        }
    }, 60 * 60 * 1000);

    // 2. Initial Run
    await evaluator.runHourlyCheck();

    // 3. Example Scanner (How to trigger the engine)
    console.log('📡 System Ready. Scanning for signals...');
    
    // In a real scenario, you'd fetch a list of stocks from Zerodha or a Watchlist
    // Here is how you would call the engine:
    /*
    const signals = await kite.getScannerSignals(); 
    for (const signal of signals) {
        await engine.evaluateTrade(signal);
    }
    */
    
    console.log('🚀 Trading System is Live.');
}

bootstrap().catch(console.error);
