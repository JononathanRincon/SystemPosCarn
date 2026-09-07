# Multi-stage Dockerfile para Backend NestJS + Prisma
# ----------------------------------------------------
# Etapa 1: Dependencias y Compilación
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar herramientas necesarias para compilación nativa en Alpine
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY tsconfig*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY src ./src

# Generar cliente de Prisma y compilar NestJS
RUN npm run prisma:generate
RUN npm run build

# ----------------------------------------------------
# Etapa 2: Runner de Producción Ligero
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl libc6-compat

# Crear usuario sin privilegios por ciberseguridad
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY package*.json ./
COPY prisma ./prisma/

# Instalar solo dependencias de producción
RUN npm ci --only=production && \
    npm run prisma:generate && \
    npm cache clean --force

# Copiar el build compilado
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

USER nestjs

EXPOSE 3001

CMD ["node", "dist/main.js"]
