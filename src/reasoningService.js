const { GoogleGenerativeAI } = require("@google/generative-ai");

class ReasoningService {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-3.1-pro-preview" });
    }

    async getReasoning(stock, features, mlProb, finalScore) {
        const prompt = `
            Analyze this stock trade signal:
            Stock: ${stock}
            Technical Data: RSI=${features.rsi}, EMA20=${features.ema20}, EMA50=${features.ema50}, MACD=${features.macd_signal}, VolumeRatio=${features.volumeRatio}
            Rule-based Score: ${features.score}
            ML Win Probability: ${(mlProb * 100).toFixed(2)}%
            Final Composite Score: ${finalScore.toFixed(2)}

            Provide a concise 2-sentence reasoning on why this stock is a good or bad candidate for a trade today.
        `;

        try {
            const result = await this.model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error('Gemini Error:', error.message);
            return "Reasoning unavailable due to API error.";
        }
    }
}

module.exports = new ReasoningService();
