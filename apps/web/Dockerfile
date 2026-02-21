FROM node:20-alpine AS build
WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm install

COPY . .
RUN npm --prefix packages/shared-types run build

ARG NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
RUN npm --prefix apps/web run build

FROM node:20-alpine AS run
WORKDIR /workspace
ENV NODE_ENV=production
ENV NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws

COPY --from=build /workspace/package.json /workspace/package-lock.json ./
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/web ./apps/web
COPY --from=build /workspace/packages/shared-types ./packages/shared-types

EXPOSE 3000
CMD ["npm", "--prefix", "apps/web", "run", "start"]
