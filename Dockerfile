FROM node:22

# RUN mkdir /root/.ssh
# COPY --from=ssh /root/.ssh /root/.ssh

# RUN chmod 400 -R ~/.ssh

COPY . .

RUN npm install
RUN ls /src/config

CMD ["node", "src/server.js"]