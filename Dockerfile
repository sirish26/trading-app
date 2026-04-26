# Use a multi-stage or combined image
FROM nikolaik/python-nodejs:python3.11-nodejs20

WORKDIR /app

# Install Python dependencies
COPY ml_service/requirements.txt ./ml_service/
RUN pip install --no-cache-dir -r ml_service/requirements.txt

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Copy all files
COPY . .

# Expose ports
EXPOSE 8000
EXPOSE 3000

# Start script to run both
CMD ["sh", "-c", "cd ml_service && uvicorn app:app --host 0.0.0.0 --port 8000 & npm start"]
