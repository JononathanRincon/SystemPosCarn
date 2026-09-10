import { Platform } from 'react-native';

let customApiBaseUrl: string | null = null;

/**
 * Permite a una tablet física en la red de la carnicería configurar la IP local
 * del servidor backend (ej. http://192.168.1.50:3001).
 */
export function setCustomApiBaseUrl(url: string | null): void {
  customApiBaseUrl = url ? url.replace(/\/+$/, '') : null;
}

/**
 * Resetea la configuración personalizada de red (para testing).
 */
export function resetApiConfig(): void {
  customApiBaseUrl = null;
}

/**
 * Determina dinámicamente la URL base del Backend NestJS.
 * Sigue la regla multiplataforma para simuladores, emuladores y tablets físicas:
 * - Si hay URL personalizada o variable de entorno, tiene máxima prioridad.
 * - Android Emulator: http://10.0.2.2:3001
 * - iOS Simulator / Web: http://localhost:3001
 */
export function getApiBaseUrl(): string {
  if (customApiBaseUrl) {
    return customApiBaseUrl;
  }

  if (typeof process !== 'undefined' && process.env) {
    const envUrl = process.env.API_BASE_URL || process.env.EXPO_PUBLIC_API_URL;
    if (envUrl) {
      return envUrl.replace(/\/+$/, '');
    }
  }

  if (Platform && Platform.OS === 'android') {
    return 'http://10.0.2.2:3001';
  }

  return 'http://localhost:3001';
}
