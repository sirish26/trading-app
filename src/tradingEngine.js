const mlClient = require('./mlClient');
const telegram = require('./telegramService');
const reasoning = require('./reasoningService');
const kite = require('./kiteService');

class TradingEngine {
    constructor(db) {
        this.db = db;
    }

    async evaluateTrade(tradeData) {
        // 1. Market Condition Filter
        const trend = await kite.getNiftyTrend();
        if (!trend.isBullish) {
            console.log("Skipping trade: NIFTY is below EMA50 (Bearish Market)");
            return null;
        }

        // 2. Rule-based Filtering (Deterministic)
        if (tradeData.score < 70 || tradeData.volumeRatio < 1.5) {
            console.log(`Filtering trade: Score ${tradeData.score} or Volume ${tradeData.volumeRatio} too low`);
            return null;
        }

        // 3. ML Probability Ranking
        const tradeCount = await this.getHistoricalTradeCount();
        const mlProb = await mlClient.getPrediction({
            rsi: tradeData.indicators.rsi,
            ema20: tradeData.indicators.ema20,
            ema50: tradeData.indicators.ema50,
            price: tradeData.entryPrice,
            macd_numeric: tradeData.indicators.macd,
            volume_ratio: tradeData.volumeRatio,
            score: tradeData.score
        });

        if (mlProb < 0.6) {
            console.log(`Filtering trade: ML Probability ${mlProb} below threshold 0.6`);
            return null;
        }

        // 4. Adaptive Scoring Logic
        const mlWeight = tradeCount >= 300 ? 0.4 : 0.2;
        const ruleWeight = 1 - mlWeight;
        const finalScore = (ruleWeight * tradeData.score) + (mlWeight * mlProb * 100);

        // 5. Reasoning (Gemini) - Explains but doesn't decide
        const explanation = await reasoning.getReasoning(tradeData.symbol, {
            ...tradeData.indicators,
            score: tradeData.score
        }, mlProb, finalScore);

        const evaluation = {
            ...tradeData,
            mlProbability: mlProb,
            finalScore: finalScore,
            reasoning: explanation,
            status: 'open',
            createdAt: new Date(),
            outcomeSource: 'system'
        };

        await this.logTrade(evaluation);
        await this.notifyTrade(evaluation);

        return evaluation;
    }

    async logTrade(data) {
        if (!this.db) return;
        await this.db.collection('trades').insertOne(data);
    }

    async notifyTrade(trade) {
        const msg = `🚀 *SWING SIGNAL: ${trade.symbol}*\n\n` +
                    `ENTRY: ${trade.entryPrice}\n` +
                    `TARGET: ${trade.targetPrice}\n` +
                    `SL: ${trade.stopLoss}\n\n` +
                    `RULE SCORE: ${trade.score}\n` +
                    `ML PROBABILITY: ${(trade.mlProbability * 100).toFixed(1)}%\n` +
                    `FINAL SCORE: ${trade.finalScore.toFixed(1)}\n\n` +
                    `*REASON:* ${trade.reasoning}`;
        await telegram.sendMessage(msg);
    }

    async submitFeedback(tradeId, feedbackText) {
        if (!this.db) return;
        // User feedback is stored as metadata, NOT used for training labels
        await this.db.collection('trades').updateOne(
            { _id: tradeId },
            { $set: { userFeedback: feedbackText, outcomeSource: 'user' } }
        );
    }

    async getHistoricalTradeCount() {
        if (!this.db) return 0;
        return await this.db.collection('trades').countDocuments({ status: { $in: ['win', 'loss'] } });
    }
}

module.exports = TradingEngine;
