import { getApiBaseUrl } from '../config/api';

export interface MobileUserSession {
  id: string;
  nombre: string;
  rol: string;
}

export interface LoginPinResult {
  success: boolean;
  valid: boolean;
  user?: MobileUserSession;
  sessionToken?: string;
  accessToken?: string;
  isOffline?: boolean;
  error?: string;
}

let activeSessionToken: string | null = null;
let activeUser: MobileUserSession | null = null;

export class AuthService {
  /**
   * Guarda en memoria o almacenamiento seguro el token de la sesión activa.
   */
  public static setSessionToken(token: string | null, user?: MobileUserSession | null): void {
    activeSessionToken = token;
    activeUser = user || null;
  }

  /**
   * Obtiene el token de sesión activo.
   */
  public static getSessionToken(): string | null {
    return activeSessionToken;
  }

  /**
   * Obtiene el usuario de la sesión activa.
   */
  public static getActiveUser(): MobileUserSession | null {
    return activeUser;
  }

  /**
   * Limpia la sesión activa.
   */
  public static clearSession(): void {
    activeSessionToken = null;
    activeUser = null;
  }

  /**
   * Inicia sesión con PIN de 4 dígitos contra el endpoint /auth/pin-login del Backend NestJS.
   * Cuenta con fallback offline resiliente para garantizar que la tablet no quede inoperativa
   * si la carnicería pierde conectividad a internet.
   */
  public static async loginConPin(
    pin: string,
    sucursalId: string,
    dispositivoId = 'tablet-mostrador-01',
    fetchFn: typeof fetch = fetch
  ): Promise<LoginPinResult> {
    if (!/^\d{4}$/.test(pin)) {
      return {
        success: false,
        valid: false,
        error: 'El PIN debe tener exactamente 4 dígitos numéricos',
      };
    }

    const baseUrl = getApiBaseUrl();
    const endpoint = `${baseUrl}/auth/pin-login`;

    try {
      const response = await fetchFn(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dispositivo-ID': dispositivoId,
        },
        body: JSON.stringify({
          pin,
          sucursalId,
          dispositivoId,
        }),
      });

      if (!response.ok) {
        let errData: any = {};
        try {
          errData = await response.json();
        } catch {
          errData = {};
        }
        return {
          success: false,
          valid: false,
          error: errData.message || `Error HTTP ${response.status} al validar PIN`,
        };
      }

      const data = await response.json();
      const token = data.accessToken || data.sessionToken;

      if (data.valid && token) {
        AuthService.setSessionToken(token, data.user);
        return {
          success: true,
          valid: true,
          user: data.user,
          sessionToken: token,
          accessToken: token,
          isOffline: false,
        };
      }

      return {
        success: false,
        valid: false,
        error: 'Credenciales inválidas',
      };
    } catch (err: any) {
      // Fallback offline resiliente: si el servidor es inalcanzable, permitir sesión local con PINs de contingencia
      if (pin === '1234' || pin === '4321') {
        const offlineUser: MobileUserSession = {
          id: 'usr-offline-cajero',
          nombre: 'Cajero Contingencia Offline',
          rol: 'Cajero',
        };
        const offlineToken = 'offline-session-token-contingencia';
        AuthService.setSessionToken(offlineToken, offlineUser);

        return {
          success: true,
          valid: true,
          user: offlineUser,
          sessionToken: offlineToken,
          accessToken: offlineToken,
          isOffline: true,
        };
      }

      return {
        success: false,
        valid: false,
        error: err?.message || 'Error de conexión al servidor y PIN no autorizado offline',
      };
    }
  }
}
