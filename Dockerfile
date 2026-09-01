FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS production

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/server ./server
COPY --from=build /app/dist ./dist
COPY --from=build /app/pictures ./pictures
COPY --from=build /app/歌单6.txt ./歌单6.txt

RUN mkdir -p /app/data
EXPOSE 3000
CMD ["npm", "start"]
