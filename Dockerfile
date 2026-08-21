# syntax=docker/dockerfile:1

# ---------- build ----------
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- runtime ----------
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime

# Aplica patches de segurança dos pacotes do sistema publicados
# depois do build da tag do base image (precisa de root; a imagem
# volta a rodar como o usuário sem privilégio por padrão)
USER root
RUN apk upgrade --no-cache
USER nginx

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/controlplus-frontend/browser /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
