/**
 * Abstracción de Hardware de Báscula (ScaleDriver)
 * Según design.md Sec. 12.3 y requisitos EARS-VENTA-02, US-02.
 * 
 * Soporta básculas comerciales estándar (Torrey, CAS, Toledo, Magellan, Datalogic)
 * mediante la Web Serial API a 9600 baudios y provee un MockScaleDriver para
 * pruebas unitarias y entornos sin hardware físico.
 */

export interface WeightReading {
  /** Peso en kilogramos redondeado a 3 decimales exactos */
  weightKg: number;
  /** Verdadero si la lectura es estable en el platillo de la báscula */
  isStable: boolean;
  /** Trama ASCII original recibida desde el puerto serial */
  rawString: string;
  /** Timestamp de la lectura en milisegundos */
  timestamp: number;
}

export interface ScaleDriver {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  onWeightChange(callback: (reading: WeightReading) => void): () => void;
  zero(): Promise<void>;
  tare(): Promise<void>;
  isConnected(): boolean;
  getLatestReading(): WeightReading | null;
}

/**
 * Parsea una trama cruda recibida de báscula serial y extrae peso y estabilidad.
 * Maneja tramas comunes de protocolos:
 * - Torrey L-EQ / MFQ: "ST,GS,+   1.250kg\r\n" o "US,GS,+   0.850kg\r\n"
 * - CAS ER-Plus / PD-II: "ST,+001.250kg\r\n" o "US,+000.500kg\r\n"
 * - Toledo / Datalogic / Magellan: "S   1.250 kg\r\n" o "D   1.250 kg\r\n"
 * - Formato genérico numérico: "1.250\r\n" o "+01.250"
 */
export function parseScaleFrame(frame: string): WeightReading | null {
  if (!frame || typeof frame !== 'string') return null;

  const trimmed = frame.trim();
  if (trimmed.length === 0) return null;

  // Detección de estabilidad
  // Prefijos usuales: ST = Stable, US = Unstable, S = Stable, D = Dynamic/Unstable
  let isStable = true;
  const upper = trimmed.toUpperCase();

  if (upper.includes('US') || upper.startsWith('D ') || upper.includes('UNSTABLE') || upper.includes('MOT')) {
    isStable = false;
  } else if (upper.includes('ST') || upper.startsWith('S ') || upper.includes('STABLE')) {
    isStable = true;
  }

  // Extracción de valor numérico con decimales
  // Busca expresiones como: +1.250, -0.050, 1.250, 0.450
  const match = trimmed.match(/([+-]?\s*\d+(?:\.\d+)?)/);
  if (!match) return null;

  // Limpiar espacios internos entre signo y número ej: "+   1.250" -> "+1.250"
  const cleanNumberStr = match[1].replace(/\s+/g, '');
  const rawNum = parseFloat(cleanNumberStr);

  if (isNaN(rawNum)) return null;

  // Redondear estrictamente a 3 decimales (kg)
  const weightKg = Math.round(rawNum * 1000) / 1000;

  return {
    weightKg,
    isStable,
    rawString: frame,
    timestamp: Date.now(),
  };
}

/**
 * Conductor Simulado (MockScaleDriver)
 * Utilizado para tests unitarios, Cypress/Playwright y modo desarrollo.
 */
export class MockScaleDriver implements ScaleDriver {
  private connected = false;
  private listeners: Set<(reading: WeightReading) => void> = new Set();
  private latestReading: WeightReading | null = null;
  private tareOffset = 0;

  async connect(): Promise<boolean> {
    this.connected = true;
    if (!this.latestReading) {
      this.setWeight(0.000, true);
    }
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.listeners.clear();
    this.latestReading = null;
    this.tareOffset = 0;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getLatestReading(): WeightReading | null {
    return this.latestReading;
  }

  onWeightChange(callback: (reading: WeightReading) => void): () => void {
    this.listeners.add(callback);
    if (this.latestReading) {
      callback(this.latestReading);
    }
    return () => {
      this.listeners.delete(callback);
    };
  }

  async zero(): Promise<void> {
    this.tareOffset = 0;
    this.setWeight(0.000, true);
  }

  async tare(): Promise<void> {
    if (this.latestReading) {
      this.tareOffset = this.latestReading.weightKg + this.tareOffset;
      this.setWeight(0.000, true);
    }
  }

  /**
   * Emite un peso simulado para pruebas o interacción en la UI.
   */
  setWeight(weightKg: number, isStable = true): void {
    const netWeight = Math.max(0, Math.round((weightKg - this.tareOffset) * 1000) / 1000);
    const reading: WeightReading = {
      weightKg: netWeight,
      isStable,
      rawString: `ST,GS,+${netWeight.toFixed(3)}kg`,
      timestamp: Date.now(),
    };
    this.latestReading = reading;
    for (const listener of this.listeners) {
      listener(reading);
    }
  }

  /**
   * Simula fluctuación de peso (pesaje en curso) hasta estabilizarse.
   */
  async simulateFluctuation(targetWeight: number, steps = 3): Promise<void> {
    for (let i = 1; i <= steps; i++) {
      const intermediate = (targetWeight / steps) * i + (Math.random() * 0.05 - 0.025);
      this.setWeight(intermediate, false);
      await new Promise((r) => setTimeout(r, 60));
    }
    this.setWeight(targetWeight, true);
  }
}

/**
 * Conductor Web Serial Real (WebSerialScaleDriver)
 * Se conecta a básculas mediante la Web Serial API nativa del navegador.
 */
export class WebSerialScaleDriver implements ScaleDriver {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private port: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private reader: any = null;
  private connected = false;
  private listeners: Set<(reading: WeightReading) => void> = new Set();
  private latestReading: WeightReading | null = null;
  private abortController: AbortController | null = null;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private onSignalLostCallback?: () => void;

  constructor(options?: { onSignalLost?: () => void }) {
    this.onSignalLostCallback = options?.onSignalLost;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getLatestReading(): WeightReading | null {
    return this.latestReading;
  }

  onWeightChange(callback: (reading: WeightReading) => void): () => void {
    this.listeners.add(callback);
    if (this.latestReading) {
      callback(this.latestReading);
    }
    return () => {
      this.listeners.delete(callback);
    };
  }

  async connect(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serial' in navigator)) {
      console.warn('Web Serial API no está soportada en este navegador.');
      return false;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const navSerial = (navigator as any).serial;
      this.port = await navSerial.requestPort();
      await this.port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });
      this.connected = true;
      this.abortController = new AbortController();

      this.startReadingLoop();
      this.resetWatchdog();
      return true;
    } catch (err) {
      console.error('Error al conectar con la báscula por Web Serial:', err);
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // Ignorar error si el lector ya fue cerrado
      }
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {
        // Ignorar error al cerrar puerto
      }
      this.port = null;
    }

    this.latestReading = null;
  }

  async zero(): Promise<void> {
    await this.writeCommand('Z\r\n');
  }

  async tare(): Promise<void> {
    await this.writeCommand('T\r\n');
  }

  private async writeCommand(cmd: string): Promise<void> {
    if (!this.port || !this.connected || !this.port.writable) return;
    try {
      const encoder = new TextEncoder();
      const writer = this.port.writable.getWriter();
      await writer.write(encoder.encode(cmd));
      writer.releaseLock();
    } catch (err) {
      console.error('Error enviando comando a báscula:', err);
    }
  }

  private resetWatchdog(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
    }
    // Si pasan más de 2500ms sin tramas, reportar pérdida de señal (Caso límite 1)
    this.watchdogTimer = setTimeout(() => {
      if (this.connected && this.onSignalLostCallback) {
        this.onSignalLostCallback();
      }
    }, 2500);
  }

  private async startReadingLoop(): Promise<void> {
    if (!this.port || !this.port.readable) return;

    try {
      const textDecoder = new TextDecoderStream();
      this.port.readable.pipeTo(textDecoder.writable);
      this.reader = textDecoder.readable.getReader();

      let buffer = '';

      while (this.connected) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split(/[\r\n]+/);
          // Mantener el último segmento incompleto en el buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            const reading = parseScaleFrame(line);
            if (reading) {
              this.latestReading = reading;
              this.resetWatchdog();
              for (const listener of this.listeners) {
                listener(reading);
              }
            }
          }
        }
      }
    } catch (err) {
      if (this.connected) {
        console.warn('Lectura serial terminada con error:', err);
      }
    } finally {
      if (this.connected) {
        await this.disconnect();
      }
    }
  }
}
