FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json

RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
COPY proto ./proto

ARG NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
ARG NEXT_PUBLIC_RELAY_HTTP_URL=http://localhost:8080
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_RELAY_HTTP_URL=$NEXT_PUBLIC_RELAY_HTTP_URL

RUN npm --prefix packages/shared-types run build
RUN npm --prefix apps/web run build

FROM node:20-alpine AS run
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=build /app/apps/web ./apps/web
COPY --from=build /app/packages/shared-types ./packages/shared-types

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm","run","start"]
