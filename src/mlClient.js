const axios = require('axios');

class MLClient {
    constructor(baseUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000') {
        this.baseUrl = baseUrl;
    }

    async getPrediction(features) {
        try {
            const response = await axios.post(`${this.baseUrl}/predict`, {
                rsi: features.rsi,
                ema20: features.ema20,
                ema50: features.ema50,
                price: features.price,
                macd_numeric: features.macd_numeric,
                volume_ratio: features.volume_ratio,
                score: features.score
            });
            return response.data.probability;
        } catch (error) {
            console.error('ML API Error:', error.message);
            return 0.5; // Neutral fallback
        }
    }
}

module.exports = new MLClient();
