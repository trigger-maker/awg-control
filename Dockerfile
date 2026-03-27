FROM node:20-alpine

RUN apk add --no-cache \
    wireguard-tools \
    curl \
    iptables \
    ip6tables

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server.js .

EXPOSE 3000

CMD ["node", "server.js"]
