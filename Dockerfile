FROM node:22

# Install dependencies
RUN apt-get update && \
  apt-get install -y poppler-utils && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

COPY . .

RUN npm install
RUN ls /
RUN ls /src
RUN ls /src/config

CMD ["node", "src/server.js"]