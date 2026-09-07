import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import Redis from 'ioredis';

interface CacheEntry {
  value: string;
  expiresAt: number;
}

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private redisClient: Redis | null = null;
  private readonly memoryCache = new Map<string, CacheEntry>();
  private useFallback = true;
  public static readonly DEFAULT_TTL_SECONDS = 3600; // 1 hora según design.md Sec. 1.3 y 9.1

  constructor(
    @Optional() redisClientOverride?: Redis | null,
    @Optional() options?: { redisUrl?: string; disableRedis?: boolean },
  ) {
    if (redisClientOverride !== undefined) {
      this.redisClient = redisClientOverride;
      this.useFallback = !this.redisClient;
      return;
    }

    if (options?.disableRedis || process.env.DISABLE_REDIS === 'true' || process.env.NODE_ENV === 'test') {
      this.logger.log('Redis deshabilitado explícitamente o entorno de pruebas: utilizando fallback en memoria.');
      this.useFallback = true;
      return;
    }

    try {
      const redisUrl = options?.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
      this.redisClient = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        retryStrategy: (times) => {
          if (times > 2) {
            this.logger.warn(`No se pudo conectar a Redis tras ${times} intentos. Conmutando a fallback en memoria.`);
            this.useFallback = true;
            return null; // Detener reintentos
          }
          return Math.min(times * 100, 1000);
        },
      });

      this.redisClient.on('connect', () => {
        this.logger.log('Conexión exitosa a Redis Server.');
        this.useFallback = false;
      });

      this.redisClient.on('error', (err) => {
        this.logger.warn(`Error de conexión a Redis (${err?.message}). Activando fallback seguro en memoria.`);
        this.useFallback = true;
      });

      // Intento de conexión no bloqueante
      this.redisClient.connect().catch((err) => {
        this.logger.warn(`Conexión inicial a Redis fallida: ${err?.message}. Operando en memoria.`);
        this.useFallback = true;
      });
    } catch (err: any) {
      this.logger.warn(`Excepción al inicializar cliente Redis (${err?.message}). Usando fallback en memoria.`);
      this.useFallback = true;
      this.redisClient = null;
    }
  }

  /**
   * Helper canónico para namespace según design.md Sec. 9.1
   */
  public static getCatalogSucursalKey(sucursalId: string): string {
    return `catalog:sucursal:${sucursalId}`;
  }

  /**
   * Consulta una clave en Redis o en el fallback de memoria.
   * Si la clave no existe o expiró, retorna null.
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.useFallback && this.redisClient) {
      try {
        const raw = await this.redisClient.get(key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
      } catch (err: any) {
        this.logger.warn(`Fallo en Redis.get('${key}'): ${err?.message}. Consultando fallback en memoria.`);
      }
    }

    // Fallback en memoria
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }

    try {
      return JSON.parse(entry.value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Almacena un valor serializado en JSON con TTL en segundos (3600 por defecto).
   */
  async set(key: string, value: any, ttlSeconds: number = RedisCacheService.DEFAULT_TTL_SECONDS): Promise<void> {
    const serialized = JSON.stringify(value);

    if (!this.useFallback && this.redisClient) {
      try {
        await this.redisClient.set(key, serialized, 'EX', ttlSeconds);
        return;
      } catch (err: any) {
        this.logger.warn(`Fallo en Redis.set('${key}'): ${err?.message}. Guardando en fallback de memoria.`);
      }
    }

    // Fallback en memoria
    this.memoryCache.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Invalida una clave específica (DEL).
   */
  async del(key: string): Promise<void> {
    this.memoryCache.delete(key);

    if (!this.useFallback && this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (err: any) {
        this.logger.warn(`Fallo en Redis.del('${key}'): ${err?.message}`);
      }
    }
  }

  /**
   * Invalida todas las claves que coincidan con un patrón (ej. 'catalog:sucursal:*').
   */
  async delPattern(pattern: string): Promise<void> {
    // 1. Limpieza en memoria
    const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const k of Array.from(this.memoryCache.keys())) {
      if (regexPattern.test(k)) {
        this.memoryCache.delete(k);
      }
    }

    // 2. Limpieza en Redis mediante SCAN para no bloquear el hilo de Redis
    if (!this.useFallback && this.redisClient) {
      try {
        const stream = this.redisClient.scanStream({
          match: pattern,
          count: 100,
        });

        stream.on('data', (keys: string[]) => {
          if (keys.length > 0) {
            const pipeline = this.redisClient!.pipeline();
            keys.forEach((key) => pipeline.del(key));
            pipeline.exec().catch(() => {});
          }
        });
      } catch (err: any) {
        this.logger.warn(`Fallo en Redis.delPattern('${pattern}'): ${err?.message}`);
      }
    }
  }

  /**
   * Limpia toda la caché almacenada.
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    if (!this.useFallback && this.redisClient) {
      try {
        await this.redisClient.flushdb();
      } catch (err: any) {
        this.logger.warn(`Fallo en Redis.clear(): ${err?.message}`);
      }
    }
  }

  public isUsingInMemoryFallback(): boolean {
    return this.useFallback;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        this.redisClient.disconnect();
      }
    }
  }
}
