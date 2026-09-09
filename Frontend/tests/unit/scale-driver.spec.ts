import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseScaleFrame,
  MockScaleDriver,
  WeightReading,
} from '@/lib/hardware/scale-driver';

describe('ScaleDriver — Hardware Abstraction & Parser', () => {
  describe('parseScaleFrame', () => {
    it('debe parsear trama estable de Torrey L-EQ con 3 decimales', () => {
      const frame = 'ST,GS,+   1.250kg\r\n';
      const reading = parseScaleFrame(frame);

      expect(reading).not.toBeNull();
      expect(reading!.weightKg).toBe(1.25);
      expect(reading!.isStable).toBe(true);
      expect(reading!.rawString).toBe(frame);
    });

    it('debe parsear trama inestable de Torrey (US)', () => {
      const frame = 'US,GS,+   0.845kg\r\n';
      const reading = parseScaleFrame(frame);

      expect(reading).not.toBeNull();
      expect(reading!.weightKg).toBe(0.845);
      expect(reading!.isStable).toBe(false);
    });

    it('debe parsear trama de báscula CAS ER-Plus con signo y ceros a la izquierda', () => {
      const frame = 'ST,+002.500kg\r\n';
      const reading = parseScaleFrame(frame);

      expect(reading).not.toBeNull();
      expect(reading!.weightKg).toBe(2.5);
      expect(reading!.isStable).toBe(true);
    });

    it('debe parsear trama Toledo/Magellan con prefijo S o D', () => {
      const frameStable = 'S   0.450 kg\r\n';
      const readingStable = parseScaleFrame(frameStable);
      expect(readingStable).not.toBeNull();
      expect(readingStable!.weightKg).toBe(0.45);
      expect(readingStable!.isStable).toBe(true);

      const frameDynamic = 'D   0.450 kg\r\n';
      const readingDynamic = parseScaleFrame(frameDynamic);
      expect(readingDynamic).not.toBeNull();
      expect(readingDynamic!.weightKg).toBe(0.45);
      expect(readingDynamic!.isStable).toBe(false);
    });

    it('debe parsear número simple continuo con signo', () => {
      const frame = '+1.755\r\n';
      const reading = parseScaleFrame(frame);

      expect(reading).not.toBeNull();
      expect(reading!.weightKg).toBe(1.755);
    });

    it('debe redondear estrictamente a 3 decimales para evitar artefactos de punto flotante', () => {
      const frame = '1.333333';
      const reading = parseScaleFrame(frame);

      expect(reading).not.toBeNull();
      expect(reading!.weightKg).toBe(1.333);
    });

    it('debe manejar peso 0.000 kg', () => {
      const frame = 'ST,GS,+   0.000kg\r\n';
      const reading = parseScaleFrame(frame);

      expect(reading).not.toBeNull();
      expect(reading!.weightKg).toBe(0);
      expect(reading!.isStable).toBe(true);
    });

    it('debe retornar null para tramas vacías o cadenas sin números', () => {
      expect(parseScaleFrame('')).toBeNull();
      expect(parseScaleFrame('   \r\n')).toBeNull();
      expect(parseScaleFrame('ERROR')).toBeNull();
    });
  });

  describe('MockScaleDriver', () => {
    let mockDriver: MockScaleDriver;

    beforeEach(async () => {
      mockDriver = new MockScaleDriver();
      await mockDriver.connect();
    });

    it('debe conectarse e inicializar en 0 kg estable', () => {
      expect(mockDriver.isConnected()).toBe(true);
      const latest = mockDriver.getLatestReading();
      expect(latest).not.toBeNull();
      expect(latest!.weightKg).toBe(0);
      expect(latest!.isStable).toBe(true);
    });

    it('debe emitir lecturas de peso a los suscriptores', () => {
      const received: WeightReading[] = [];
      const unsub = mockDriver.onWeightChange((r) => received.push(r));

      mockDriver.setWeight(2.35, true);
      mockDriver.setWeight(2.5, true);

      expect(received.length).toBe(3); // Initial 0 + 2.35 + 2.5
      expect(received[received.length - 1].weightKg).toBe(2.5);

      unsub();
      mockDriver.setWeight(3.0, true);
      expect(received.length).toBe(3); // No recibe más tras unsubscribe
    });

    it('debe aplicar tara correctamente a lecturas subsecuentes', async () => {
      mockDriver.setWeight(0.25, true); // Peso del recipiente: 250g
      await mockDriver.tare(); // Tarar a 0

      expect(mockDriver.getLatestReading()!.weightKg).toBe(0);

      // Ahora se coloca 1.500 kg de carne en el recipiente (bruto 1.750 kg)
      mockDriver.setWeight(1.75, true);
      expect(mockDriver.getLatestReading()!.weightKg).toBe(1.5);
    });

    it('debe restablecer a cero la tara al llamar a zero()', async () => {
      mockDriver.setWeight(0.5, true);
      await mockDriver.tare();
      expect(mockDriver.getLatestReading()!.weightKg).toBe(0);

      await mockDriver.zero();
      mockDriver.setWeight(1.0, true);
      expect(mockDriver.getLatestReading()!.weightKg).toBe(1.0);
    });

    it('debe desconectarse y limpiar suscriptores', async () => {
      await mockDriver.disconnect();
      expect(mockDriver.isConnected()).toBe(false);
      expect(mockDriver.getLatestReading()).toBeNull();
    });
  });
});
