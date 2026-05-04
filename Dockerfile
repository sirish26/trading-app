# Use a multi-stage or combined image
FROM nikolaik/python-nodejs:python3.11-nodejs20

WORKDIR /app

# Install Chromium and all necessary shared libraries for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    librandr2 \
    libgbm1 \
    libasound2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

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
