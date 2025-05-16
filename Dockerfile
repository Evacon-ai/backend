FROM node:22

COPY . .

RUN npm install
RUN ls /
RUN ls /src
RUN ls /src/config

CMD ["node", "src/server.js"]