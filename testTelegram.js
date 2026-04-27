require('dotenv').config();
const telegram = require('./src/telegramService');

async function test() {
    const dummyMsg = `🚀 *SWING SIGNAL: RELIANCE*\n\n` +
                     `ENTRY: 2540.50\n` +
                     `TARGET: 2667.50\n` +
                     `SL: 2465.00\n\n` +
                     `RULE SCORE: 78\n` +
                     `ML PROBABILITY: 72.5%\n` +
                     `FINAL SCORE: 76.8\n\n` +
                     `*REASON:* The stock shows strong bullish momentum with RSI at 65 and is trading above its EMA20. The ML model predicts a high win probability based on the recent volume surge.`;
    
    console.log('Sending dummy alert to:', process.env.TELEGRAM_CHAT_ID);
    await telegram.sendMessage(dummyMsg);
    console.log('Done.');
    process.exit(0);
}

test();
