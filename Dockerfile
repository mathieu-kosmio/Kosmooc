# Académie PerfIA : un seul conteneur (PocketBase sert l'API et le site statique).
# Déploiement Coolify : type Dockerfile, port 8090, volume persistant sur /pb/pb_data.

FROM node:22-alpine AS web
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npx astro build --outDir /app/pb_public

FROM alpine:3.20
ARG PB_VERSION=0.30.0
RUN apk add --no-cache ca-certificates unzip wget \
 && wget -q https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip -O /tmp/pb.zip \
 && unzip /tmp/pb.zip pocketbase -d /pb && rm /tmp/pb.zip && apk del unzip wget \
 && echo "text/vtt vtt" >> /etc/mime.types
WORKDIR /pb
COPY backend/pb_migrations ./pb_migrations
COPY backend/pb_hooks ./pb_hooks
COPY backend/quiz ./quiz
COPY --from=web /app/pb_public ./pb_public
ENV ACADEMIE_QUIZ_DIR=/pb/quiz
EXPOSE 8090
VOLUME /pb/pb_data
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data"]
