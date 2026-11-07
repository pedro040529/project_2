# Etapa 1: compilar el sitio estático
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
RUN npx vite build

# Etapa 2: servir con nginx (escucha en $PORT, requerido por Render/Railway/Fly)
FROM nginx:1.27-alpine
ENV PORT=8080
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
