FROM node:20-alpine

WORKDIR ./
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci && npx prisma generate

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# create data dir for sqlite
RUN mkdir -p /data
ENV DATABASE_URL="file:/data/db.sqlite"

# migrate on container start, then run
CMD sh -c "npx prisma migrate deploy && node dist/index.js"
