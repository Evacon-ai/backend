FROM node:22-slim

# Install Chromium dependencies
RUN apt-get update && apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  wget \
  libxshmfence1 \
  libxext6 \
  libxfixes3 \
  libgl1 \
  --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Add a non-root user for Chromium sandboxing (optional but cleaner)
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Let Puppeteer install its own compatible Chrome
ENV PUPPETEER_SKIP_DOWNLOAD=false
ENV PUPPETEER_CACHE_DIR=/home/pptruser/.cache/puppeteer

# Install dependencies BEFORE switching user
RUN npm install
RUN ./node_modules/.bin/puppeteer browsers install chrome

# Set environment variables for Puppeteer stability
ENV PORT=8080
ENV NODE_ENV=production

# Expose port for Cloud Run
EXPOSE 8080

# Run as non-root user
USER pptruser

# Start the app
CMD ["node", "src/server.js"]
