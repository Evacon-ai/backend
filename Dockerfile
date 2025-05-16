# Use official Node.js image
FROM node:22-slim

# Set working directory
WORKDIR /app

# Copy only package.json/package-lock.json first for better cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose the Cloud Run default port
EXPOSE 8080

# Start the server
CMD ["node", "src/server.js"]