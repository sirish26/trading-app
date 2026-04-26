const kite = require('./kiteService');

class TradeEvaluator {
    constructor(db) {
        this.db = db;
    }

    async runHourlyCheck() {
        if (!this.db) return;

        const openTrades = await this.db.collection('trades').find({ status: 'open' }).toArray();
        if (openTrades.length === 0) return;

        const symbols = openTrades.map(t => t.symbol);
        const ltpData = await kite.getLTP(symbols);

        for (const trade of openTrades) {
            const currentPrice = ltpData[trade.symbol].last_price;
            let newStatus = 'open';

            if (currentPrice >= trade.targetPrice) {
                newStatus = 'win';
            } else if (currentPrice <= trade.stopLoss) {
                newStatus = 'loss';
            }

            if (newStatus !== 'open') {
                await this.db.collection('trades').updateOne(
                    { _id: trade._id },
                    { 
                        $set: { 
                            status: newStatus, 
                            evaluatedAt: new Date(),
                            exitPrice: currentPrice
                        } 
                    }
                );
                console.log(`Trade ${trade.symbol} closed as ${newStatus} at ${currentPrice}`);
            }
        }
    }
}

module.exports = TradeEvaluator;
