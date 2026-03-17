# Etapa 1: Construcción de React - Fase de dependencias
FROM node:24.12.0-alpine3.23 AS deps
WORKDIR /app

# Instalar pnpm globalmente
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
# Cambia a npm install para incluir devDependencies
RUN pnpm install --prefer-offline

# Etapa 2: Construcción de React - Fase de build
FROM node:24.12.0-alpine3.23 AS build
WORKDIR /app

# Instalar pnpm globalmente
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG VITE_API_URL

# Crar archivo .env dentro de app para que Vite pueda leer las variables de entorno
RUN echo "VITE_API_URL=${VITE_API_URL}" > .env

# Imprimir lo que quedo en el .env para debug
RUN cat .env
# Añade flags para producción
RUN pnpm run build -- --mode production

# Etapa 3: Servir con Nginx (se mantiene igual)
FROM nginx:1.28.1-alpine3.23

# Instalar solo lo esencial y limpiar cache
RUN apk add --no-cache --update curl && \
    rm -rf /var/cache/apk/*

# Configuración de seguridad y optimización
COPY compose/production/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Configurar permisos y usuario no-root
RUN chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl --fail http://localhost:80 || exit 1

USER nginx

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]