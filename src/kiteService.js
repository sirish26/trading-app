const KiteTicker = require("kiteconnect").KiteTicker;
const KiteConnect = require("kiteconnect").KiteConnect;

class KiteService {
    constructor() {
        this.apiKey = process.env.KITE_API_KEY;
        this.accessToken = process.env.KITE_ACCESS_TOKEN;
        this.kc = new KiteConnect({ api_key: this.apiKey });
        this.kc.setAccessToken(this.accessToken);
    }

    async getLTP(symbols) {
        const quotes = await this.kc.getLTP(symbols);
        return quotes;
    }

    async getNiftyTrend() {
        try {
            const niftySymbol = "NSE:NIFTY 50";
            const quote = await this.kc.getQuotes([niftySymbol]);
            const ltp = quote[niftySymbol].last_price;
            
            // Simplified EMA50 check (in production you'd fetch historical to calculate real EMA)
            // For now, we'll assume a threshold or fetch last 50 candles
            const history = await this.kc.getHistoricalData(256265, "day", 
                new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), new Date());
            
            const ema50 = this.calculateEMA(history.map(d => d.close), 50);
            return { ltp, ema50, isBullish: ltp > ema50 };
        } catch (e) {
            console.error("Kite Trend Error:", e.message);
            return { isBullish: true }; // Default to bullish on error to avoid blocking
        }
    }

    calculateEMA(data, period) {
        const k = 2 / (period + 1);
        let ema = data[0];
        for (let i = 1; i < data.length; i++) {
            ema = data[i] * k + ema * (1 - k);
        }
        return ema;
    }
}

module.exports = new KiteService();
