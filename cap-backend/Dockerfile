FROM node:22-bookworm AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY app/frontend/package*.json ./app/frontend/
RUN cd app/frontend && npm ci

COPY . .
RUN npm run build:web && npm run sync:approuter && npx cds build

FROM node:22-bookworm AS runtime

WORKDIR /app
ENV PORT=4004

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/app ./app
COPY --from=build /app/db ./db
COPY --from=build /app/srv ./srv
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/.cdsrc.json ./.cdsrc.json

EXPOSE 4004

CMD ["sh", "-c", "npx cds-deploy && npm start"]
