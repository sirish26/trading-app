import pandas as pd
import xgboost as xgb
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
import time

app = FastAPI()
MODEL_PATH = "model.json"
model = None

# Load model globally for warm start
if os.path.exists(MODEL_PATH):
    model = xgb.XGBClassifier()
    model.load_model(MODEL_PATH)

class PredictionInput(BaseModel):
    rsi: float
    ema20: float
    ema50: float
    price: float
    macd_numeric: float
    volume_ratio: float
    score: float

@app.post("/predict")
async def predict(input_data: PredictionInput):
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")

    start_time = time.time()
    
    # Fast feature processing
    features = pd.DataFrame([{
        'rsi': input_data.rsi,
        'ema_diff': input_data.ema20 - input_data.ema50,
        'price_vs_ema50': input_data.price / input_data.ema50,
        'macd_numeric': input_data.macd_numeric,
        'volume_ratio': input_data.volume_ratio,
        'score': input_data.score
    }])
    
    # Predict probability
    probs = model.predict_proba(features)
    probability = float(probs[0][1])
    
    latency = (time.time() - start_time) * 1000
    
    return {
        "probability": probability,
        "latency_ms": round(latency, 2)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
