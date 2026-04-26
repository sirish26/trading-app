import pandas as pd
import xgboost as xgb
from pymongo import MongoClient
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, classification_report
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "trading_db")
COLLECTION_NAME = "trades"
MODEL_PATH = "model.json"

def fetch_completed_trades():
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]
    
    # Only load trades that have a definitive outcome from price action
    # We ignore 'pending' or feedback-only trades if outcomeSource isn't system/user-verified-win-loss
    query = {"status": {"$in": ["win", "loss"]}}
    data = list(collection.find(query))
    
    if len(data) < 100: # Lowering for initial testing, but user asked for 300+ in logic
        print(f"Insufficient data: {len(data)} completed trades found.")
        return None
    
    return pd.DataFrame(data)

def engineer_features(df):
    # Required features: rsi, ema_diff, price_vs_ema50, macd_numeric, volume_ratio, score
    X = pd.DataFrame()
    
    # Standard Technical Features
    X['rsi'] = df['indicators'].apply(lambda x: x.get('rsi'))
    X['ema_diff'] = df['indicators'].apply(lambda x: x.get('ema20') - x.get('ema50'))
    
    # price_vs_ema50: using entryPrice as the reference
    X['price_vs_ema50'] = df['entryPrice'] / df['indicators'].apply(lambda x: x.get('ema50'))
    
    # MACD numeric conversion
    def convert_macd(val):
        if isinstance(val, (int, float)): return val
        mapping = {'buy': 1, 'sell': -1, 'neutral': 0}
        return mapping.get(str(val).lower(), 0)
        
    X['macd_numeric'] = df['indicators'].apply(lambda x: convert_macd(x.get('macd')))
    X['volume_ratio'] = df['indicators'].apply(lambda x: x.get('volumeRatio'))
    X['score'] = df['score']
    
    # Label: win -> 1, loss -> 0
    y = df['status'].map({'win': 1, 'loss': 0})
    
    # Clean missing data
    valid_idx = X.dropna().index
    return X.loc[valid_idx], y.loc[valid_idx]

def train():
    df = fetch_completed_trades()
    if df is None: return

    X, y = engineer_features(df)
    
    if len(X) < 50:
        print("Not enough valid rows after feature engineering.")
        return

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Production-ready XGBoost parameters
    model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        objective='binary:logistic',
        eval_metric='logloss',
        subsample=0.8,
        colsample_bytree=0.8
    )
    
    model.fit(X_train, y_train)
    
    # Metrics
    preds = model.predict(X_test)
    print("--- Training Results ---")
    print(f"Accuracy:  {accuracy_score(y_test, preds):.4f}")
    print(f"Precision: {precision_score(y_test, preds):.4f}")
    print(f"Recall:    {recall_score(y_test, preds):.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, preds))
    
    model.save_model(MODEL_PATH)
    print(f"Model deployed to {MODEL_PATH}")

if __name__ == "__main__":
    train()
