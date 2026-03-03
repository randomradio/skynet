FROM node:20-alpine

WORKDIR /app

COPY package.json tsconfig.json ./
COPY src ./src

RUN npm install -g pnpm && pnpm install
RUN pnpm build

CMD ["node", "dist/index.js"]
