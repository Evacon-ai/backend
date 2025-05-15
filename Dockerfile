FROM node:22-slim

# Add non-root user for Puppeteer
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser

# Puppeteer environment
ENV PUPPETEER_SKIP_DOWNLOAD=false
ENV PUPPETEER_PRODUCT=chrome
ENV PUPPETEER_CACHE_DIR=/home/pptruser/.cache/puppeteer

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
  --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Set working directory and copy package files
WORKDIR /home/pptruser/app
COPY --chown=pptruser:pptruser package*.json ./

# Switch to non-root user
USER pptruser

# Install dependencies
RUN mkdir -p ~/.npm && npm install

# Copy all source files after deps are installed
COPY --chown=pptruser:pptruser . .

# Set runtime environment
ENV PORT=8080
ENV NODE_ENV=production

# Expose port for Cloud Run
EXPOSE 8080

CMD ["node", "src/server.js"]
