const SENSITIVE_KEY_PATTERN = /password|pin|password_hash|pin_pos_hash|token|refreshtoken|accesstoken|authorization|secret/i;

/**
 * Enmascara recursivamente cualquier campo sensible (password, pin, tokens, etc.)
 * reemplazando su valor con '***' para proteger la privacidad en logs canónicos.
 */
export function maskSensitiveData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item));
  }

  const masked: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      masked[key] = '***';
    } else if (typeof value === 'object') {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}