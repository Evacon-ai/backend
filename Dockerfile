FROM node:22-slim

# Add a non-root user for Chromium sandboxing (optional but cleaner)
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser

# Let Puppeteer install its own compatible Chrome
ENV PUPPETEER_SKIP_DOWNLOAD=false
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

# Create app dir
WORKDIR /app

# Copy only package files first for cache
COPY package*.json ./

# Install all node modules including puppeteer
RUN npm install

# Now that puppeteer is installed, install Chrome explicitly
RUN node ./node_modules/puppeteer/lib/cjs/puppeteer/revisions.js install chrome

# Copy project files
COPY . .

# Set environment variables for Puppeteer stability
ENV PORT=8080
ENV NODE_ENV=production

# Expose port for Cloud Run
EXPOSE 8080

# Run as non-root user
USER pptruser

# Start the app
CMD ["node", "src/server.js"]
