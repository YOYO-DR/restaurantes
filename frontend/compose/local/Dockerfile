# Utiliza una imagen oficial de Node.js
FROM node:24.12.0-alpine3.23

# Establece el directorio de trabajo
WORKDIR /app

# Instalar pnpm globalmente
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copia los archivos de dependencias
COPY package.json pnpm-lock.yaml ./

# Instala las dependencias
RUN pnpm install

# Copia el resto del código fuente
COPY . .

# Expone el puerto por defecto de Vite
EXPOSE 8080

# Comando por defecto para desarrollo
CMD ["pnpm", "run", "dev", "--", "--host"]
