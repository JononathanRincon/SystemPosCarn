/**
 * ScaleBridge: Módulo puente para comunicación serie USB-OTG (CH340/FTDI chipsets)
 * a 9600 baudios, 8N1 con parser de tramas continuas de peso (decimal(10,3))
 * y detección de estabilidad.
 *
 * Cumple con design.md §13, requirements.md US-02, EARS-VENTA-02 y Edge Cases 1 & 2.
 */

export interface WeightReading {
  /** Peso en kilogramos formateado estrictamente a 3 decimales exactos */
  weightKg: number;
  /** Verdadero si la lectura es estable en el platillo de la báscula */
  isStable: boolean;
  /** Trama ASCII original recibida desde el puerto serial */
  rawFrame: string;
  /** Timestamp de la lectura en milisegundos */
  timestamp: number;
  /** Unidad de medida ('kg') */
  unit: string;
  /** Indica si la lectura es <= 0.000 (guardia de cero o negativo) */
  isZero: boolean;
  /** Indica si la lectura es un peso válido y positivo (> 0.000) */
  isValid: boolean;
}

export interface ScaleBridgeOptions {
  baudRate?: number; // default 9600
  dataBits?: number; // default 8
  stopBits?: number; // default 1
  parity?: number;   // default 0 (none)
}

export interface IScaleBridge {
  connect(options?: ScaleBridgeOptions): Promise<boolean>;
  disconnect(): Promise<void>;
  onWeightChange(callback: (reading: WeightReading) => void): () => void;
  setWeight(weightKg: number, isStable?: boolean): void;
  tare(): Promise<void> | void;
  zero(): Promise<void> | void;
  isConnected(): boolean;
  getLatestReading(): WeightReading | null;
  feedData?(chunk: string): WeightReading[];
  parseWeight?(frame: string): WeightReading | null;
}

/**
 * Parsea una trama cruda recibida de báscula serial y extrae peso y estabilidad.
 * Protocolos soportados:
 * - Torrey: "ST,GS,+001.250kg\r\n", "ST,GS,+   1.250kg\r\n", "US,GS,+   0.845kg\r\n", "01.450\r"
 * - CAS: "ST,+002.500kg\r\n", "ST,NT,  1.450 kg\r\n", "US,+000.500kg\r\n"
 * - Toledo / Magellan: "S   0.450 kg\r\n", "D   0.450 kg\r\n"
 * - Genérico numérico: "+1.755\r\n", "1.250\r\n", "1.333333"
 */
export function parseWeight(frame: string): WeightReading | null {
  if (!frame || typeof frame !== 'string') return null;

  const trimmed = frame.trim();
  if (trimmed.length === 0) return null;

  const upper = trimmed.toUpperCase();

  // Control / Error frames that do not represent weight
  if (
    upper === 'ERROR' ||
    upper === 'ERR' ||
    upper === 'ACK' ||
    upper === 'NAK' ||
    upper === '?' ||
    upper === 'SYN'
  ) {
    return null;
  }

  // 1. Detección de estabilidad
  // 'US' = Unstable (Torrey, CAS)
  // 'D ' or 'D\t' = Dynamic/Unstable (Toledo / Magellan)
  // 'UNSTABLE', 'MOT' = Motion / Unstable
  // 'ST' = Stable (Torrey, CAS)
  // 'S ' or 'S\t' = Stable (Toledo / Magellan)
  // 'STABLE' = Stable
  let isStable = true;
  if (
    upper.includes('US,') ||
    upper.includes(',US') ||
    upper.startsWith('US') ||
    upper.includes('UNSTABLE') ||
    upper.includes('MOT') ||
    /^D[\s\t]/.test(upper)
  ) {
    isStable = false;
  } else if (
    upper.includes('ST,') ||
    upper.includes(',ST') ||
    upper.startsWith('ST') ||
    upper.includes('STABLE') ||
    /^S[\s\t]/.test(upper)
  ) {
    isStable = true;
  }

  // 2. Extracción numérica
  // Coincide con expresiones con signos opcionales, espacios y decimales
  const match = trimmed.match(/([+-]?\s*\d+(?:\.\d+)?)/);
  if (!match) return null;

  // Limpiar espacios entre signo y dígitos (ej. "+   1.250" -> "+1.250")
  const cleanNumberStr = match[1].replace(/\s+/g, '');
  const parsedVal = parseFloat(cleanNumberStr);

  if (isNaN(parsedVal) || !isFinite(parsedVal)) {
    return null;
  }

  // Formato estricto de precisión a 3 decimales (decimal(10,3)): Number(val.toFixed(3))
  const weightKg = Number(parsedVal.toFixed(3));

  // Guardia de cero / negativo: lecturas <= 0.000 se identifican como cero o no válidas
  const isZero = weightKg <= 0.000;
  const isValid = weightKg > 0.000;

  return {
    weightKg,
    isStable,
    rawFrame: frame,
    timestamp: Date.now(),
    unit: 'kg',
    isZero,
    isValid,
  };
}

/**
 * Buffer acumulador para reensamblar flujos continuos de datos seriales
 * fragmentados a través de múltiples chunks.
 */
export class StreamBuffer {
  private buffer = '';

  public push(chunk: string): string[] {
    if (!chunk || typeof chunk !== 'string') return [];
    this.buffer += chunk;
    const lines = this.buffer.split(/\r\n|\r|\n/);
    // Retener en el buffer el segmento incompleto final
    this.buffer = lines.pop() ?? '';
    return lines.filter((line) => line.trim().length > 0);
  }

  public clear(): void {
    this.buffer = '';
  }

  public getPendingBuffer(): string {
    return this.buffer;
  }
}

/**
 * Driver Simulado de Báscula (MockScaleBridge)
 * Utilizado para tests unitarios, UI previews y entornos sin hardware físico.
 */
export class MockScaleBridge implements IScaleBridge {
  private connected = false;
  private tareOffset = 0;
  private latestReading: WeightReading | null = null;
  private listeners: Set<(reading: WeightReading) => void> = new Set();

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

  setWeight(weightKg: number, isStable = true): void {
    const netRaw = weightKg - this.tareOffset;
    const netClamped = Math.max(0, netRaw);
    const finalWeight = Number(netClamped.toFixed(3));
    const isZero = finalWeight <= 0.000;
    const isValid = finalWeight > 0.000;

    const reading: WeightReading = {
      weightKg: finalWeight,
      isStable,
      rawFrame: `ST,GS,+${finalWeight.toFixed(3)}kg\r\n`,
      timestamp: Date.now(),
      unit: 'kg',
      isZero,
      isValid,
    };
    this.latestReading = reading;
    for (const listener of this.listeners) {
      listener(reading);
    }
  }

  async tare(): Promise<void> {
    if (this.latestReading) {
      this.tareOffset = this.latestReading.weightKg + this.tareOffset;
      this.setWeight(0.000, true);
    }
  }

  async zero(): Promise<void> {
    this.tareOffset = 0;
    this.setWeight(0.000, true);
  }

  parseWeight(frame: string): WeightReading | null {
    return parseWeight(frame);
  }

  feedData(chunk: string): WeightReading[] {
    const lines = chunk.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0);
    const readings: WeightReading[] = [];
    for (const line of lines) {
      const r = parseWeight(line);
      if (r) {
        this.setWeight(r.weightKg, r.isStable);
        if (this.latestReading) readings.push(this.latestReading);
      }
    }
    return readings;
  }
}

/**
 * Driver Real USB-OTG Serial Bridge (ScaleBridge)
 * Se comunica con adaptadores CH340 / FTDI a 9600 baudios, 8N1.
 */
export class ScaleBridge implements IScaleBridge {
  private connected = false;
  private tareOffset = 0;
  private latestReading: WeightReading | null = null;
  private listeners: Set<(reading: WeightReading) => void> = new Set();
  private streamBuffer = new StreamBuffer();
  private options: Required<ScaleBridgeOptions>;

  constructor(options?: ScaleBridgeOptions) {
    this.options = {
      baudRate: options?.baudRate ?? 9600,
      dataBits: options?.dataBits ?? 8,
      stopBits: options?.stopBits ?? 1,
      parity: options?.parity ?? 0,
    };
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

  async connect(options?: ScaleBridgeOptions): Promise<boolean> {
    if (options) {
      this.options = {
        baudRate: options.baudRate ?? this.options.baudRate,
        dataBits: options.dataBits ?? this.options.dataBits,
        stopBits: options.stopBits ?? this.options.stopBits,
        parity: options.parity ?? this.options.parity,
      };
    }

    try {
      let RNSerialport: any = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        RNSerialport = require('react-native-serialport').RNSerialport;
      } catch {}

      if (RNSerialport && typeof RNSerialport.startService === 'function') {
        await RNSerialport.startService();
      }
      this.connected = true;
      this.streamBuffer.clear();
      return true;
    } catch {
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.streamBuffer.clear();
    this.latestReading = null;
    this.tareOffset = 0;

    try {
      let RNSerialport: any = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        RNSerialport = require('react-native-serialport').RNSerialport;
      } catch {}

      if (RNSerialport && typeof RNSerialport.stopService === 'function') {
        await RNSerialport.stopService();
      }
    } catch {}
  }

  feedData(chunk: string): WeightReading[] {
    const frames = this.streamBuffer.push(chunk);
    const readings: WeightReading[] = [];

    for (const frame of frames) {
      const reading = parseWeight(frame);
      if (reading) {
        const netRaw = reading.weightKg - this.tareOffset;
        const netClamped = Math.max(0, netRaw);
        const finalWeight = Number(netClamped.toFixed(3));
        const adjustedReading: WeightReading = {
          ...reading,
          weightKg: finalWeight,
          isZero: finalWeight <= 0.000,
          isValid: finalWeight > 0.000,
        };
        this.latestReading = adjustedReading;
        readings.push(adjustedReading);
        for (const listener of this.listeners) {
          listener(adjustedReading);
        }
      }
    }
    return readings;
  }

  setWeight(weightKg: number, isStable = true): void {
    const netRaw = weightKg - this.tareOffset;
    const netClamped = Math.max(0, netRaw);
    const finalWeight = Number(netClamped.toFixed(3));
    const reading: WeightReading = {
      weightKg: finalWeight,
      isStable,
      rawFrame: `ST,GS,+${finalWeight.toFixed(3)}kg\r\n`,
      timestamp: Date.now(),
      unit: 'kg',
      isZero: finalWeight <= 0.000,
      isValid: finalWeight > 0.000,
    };
    this.latestReading = reading;
    for (const listener of this.listeners) {
      listener(reading);
    }
  }

  async tare(): Promise<void> {
    if (this.latestReading) {
      this.tareOffset = this.latestReading.weightKg + this.tareOffset;
      this.setWeight(0.000, true);
    }
    try {
      let RNSerialport: any = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        RNSerialport = require('react-native-serialport').RNSerialport;
      } catch {}
      if (RNSerialport && typeof RNSerialport.writeString === 'function') {
        await RNSerialport.writeString('T\r\n');
      }
    } catch {}
  }

  async zero(): Promise<void> {
    this.tareOffset = 0;
    this.setWeight(0.000, true);
    try {
      let RNSerialport: any = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        RNSerialport = require('react-native-serialport').RNSerialport;
      } catch {}
      if (RNSerialport && typeof RNSerialport.writeString === 'function') {
        await RNSerialport.writeString('Z\r\n');
      }
    } catch {}
  }

  parseWeight(frame: string): WeightReading | null {
    return parseWeight(frame);
  }
}
