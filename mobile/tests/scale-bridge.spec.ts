import {
  parseWeight,
  StreamBuffer,
  ScaleBridge,
  MockScaleBridge,
  WeightReading,
} from '../src/services/ScaleBridge';

describe('ScaleBridge & Serial Hardware Parser Suite', () => {
  describe('1. Multi-Protocol Frame Parsing (parseWeight)', () => {
    it('should parse Torrey L-EQ standard frame with stable flag', () => {
      const reading = parseWeight('ST,GS,+001.250kg\r\n');
      expect(reading).not.toBeNull();
      expect(reading?.weightKg).toBe(1.25);
      expect(reading?.isStable).toBe(true);
      expect(reading?.unit).toBe('kg');
      expect(reading?.isZero).toBe(false);
      expect(reading?.isValid).toBe(true);
    });

    it('should parse Torrey frame with inner spaces between sign and digits', () => {
      const reading = parseWeight('ST,GS,+   1.250kg\r\n');
      expect(reading).not.toBeNull();
      expect(reading?.weightKg).toBe(1.25);
      expect(reading?.isStable).toBe(true);
    });

    it('should parse Torrey unstable frame (US,GS)', () => {
      const reading = parseWeight('US,GS,+   0.845kg\r\n');
      expect(reading).not.toBeNull();
      expect(reading?.weightKg).toBe(0.845);
      expect(reading?.isStable).toBe(false);
      expect(reading?.isValid).toBe(true);
    });

    it('should parse Torrey compact frame ending in carriage return only', () => {
      const reading = parseWeight('01.450\r');
      expect(reading).not.toBeNull();
      expect(reading?.weightKg).toBe(1.45);
      expect(reading?.isStable).toBe(true);
    });

    it('should parse CAS ER-Plus frame (ST,+002.500kg)', () => {
      const reading = parseWeight('ST,+002.500kg\r\n');
      expect(reading).not.toBeNull();
      expect(reading?.weightKg).toBe(2.5);
      expect(reading?.isStable).toBe(true);
    });

    it('should parse CAS net weight frame (ST,NT)', () => {
      const reading = parseWeight('ST,NT,  1.450 kg\r\n');
      expect(reading).not.toBeNull();
      expect(reading?.weightKg).toBe(1.45);
      expect(reading?.isStable).toBe(true);
    });

    it('should parse CAS unstable frame (US,+000.500kg)', () => {
      const reading = parseWeight('US,+000.500kg\r\n');
      expect(reading).not.toBeNull();
      expect(reading?.weightKg).toBe(0.5);
      expect(reading?.isStable).toBe(false);
    });

    it('should parse Toledo/Magellan stable frame (S   0.450 kg)', () => {
      const reading = parseWeight('S   0.450 kg\r\n');
      expect(reading).not.toBeNull();
      expect(reading?.weightKg).toBe(0.45);
      expect(reading?.isStable).toBe(true);
    });

    it('should parse Toledo/Magellan dynamic/unstable frame (D   0.450 kg)', () => {
      const reading = parseWeight('D   0.450 kg\r\n');
      expect(reading).not.toBeNull();
      expect(reading?.weightKg).toBe(0.45);
      expect(reading?.isStable).toBe(false);
    });

    it('should parse generic raw signed numeric frames (+1.755)', () => {
      const reading = parseWeight('+1.755\r\n');
      expect(reading).not.toBeNull();
      expect(reading?.weightKg).toBe(1.755);
      expect(reading?.isStable).toBe(true);
    });

    it('should parse generic unsigned numeric frames (1.250)', () => {
      const reading = parseWeight('1.250\r\n');
      expect(reading).not.toBeNull();
      expect(reading?.weightKg).toBe(1.25);
      expect(reading?.isStable).toBe(true);
    });

    it('should detect zero readings and flag as isZero: true and isValid: false', () => {
      const reading = parseWeight('ST,GS,+   0.000kg\r\n');
      expect(reading).not.toBeNull();
      expect(reading?.weightKg).toBe(0);
      expect(reading?.isZero).toBe(true);
      expect(reading?.isValid).toBe(false);
    });

    it('should detect negative readings (weight <= 0.000) as invalid guard', () => {
      const reading = parseWeight('-0.050\r\n');
      expect(reading).not.toBeNull();
      expect(reading?.weightKg).toBe(-0.05);
      expect(reading?.isZero).toBe(true);
      expect(reading?.isValid).toBe(false);
    });

    it('should return null for malformed or noise inputs', () => {
      expect(parseWeight('')).toBeNull();
      expect(parseWeight('    \r\n')).toBeNull();
      expect(parseWeight('ERROR')).toBeNull();
      expect(parseWeight('ERR')).toBeNull();
      expect(parseWeight('ACK')).toBeNull();
      expect(parseWeight('???')).toBeNull();
    });
  });

  describe('2. Strict 3-Decimal Precision & Float Sanitization', () => {
    it('should format continuous repeating decimals strictly to 3 decimal places', () => {
      const reading = parseWeight('1.333333333\r\n');
      expect(reading).not.toBeNull();
      expect(reading?.weightKg).toBe(1.333);
      expect(reading?.weightKg.toFixed(3)).toBe('1.333');
    });

    it('should sanitize floating point binary representation artifacts', () => {
      const rawFloatArtifact = (0.1 + 0.2).toString(); // '0.30000000000000004'
      const reading = parseWeight(`${rawFloatArtifact}\r\n`);
      expect(reading).not.toBeNull();
      expect(reading?.weightKg).toBe(0.3);
    });

    it('should round boundary values properly', () => {
      const reading = parseWeight('2.9999\r\n');
      expect(reading).not.toBeNull();
      expect(reading?.weightKg).toBe(3.0);
    });
  });

  describe('3. Continuous Stream Chunk Reassembly (StreamBuffer)', () => {
    it('should reassemble a frame split across 2 chunks', () => {
      const buffer = new StreamBuffer();

      // Chunk 1: Incomplete start
      const lines1 = buffer.push('ST,GS,');
      expect(lines1).toEqual([]);
      expect(buffer.getPendingBuffer()).toBe('ST,GS,');

      // Chunk 2: Remainder and delimiter
      const lines2 = buffer.push('+001.250kg\r\n');
      expect(lines2).toEqual(['ST,GS,+001.250kg']);
      expect(buffer.getPendingBuffer()).toBe('');

      const reading = parseWeight(lines2[0]);
      expect(reading?.weightKg).toBe(1.25);
    });

    it('should reassemble a frame split across 3 chunks', () => {
      const buffer = new StreamBuffer();

      expect(buffer.push('S   0')).toEqual([]);
      expect(buffer.push('.450 ')).toEqual([]);
      const lines = buffer.push('kg\r\n');

      expect(lines).toEqual(['S   0.450 kg']);
      const reading = parseWeight(lines[0]);
      expect(reading?.weightKg).toBe(0.45);
      expect(reading?.isStable).toBe(true);
    });

    it('should extract multiple completed frames in a single chunk', () => {
      const buffer = new StreamBuffer();
      const lines = buffer.push('ST,GS,+001.250kg\r\nST,GS,+002.500kg\r\n');

      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('ST,GS,+001.250kg');
      expect(lines[1]).toBe('ST,GS,+002.500kg');

      const reading1 = parseWeight(lines[0]);
      const reading2 = parseWeight(lines[1]);
      expect(reading1?.weightKg).toBe(1.25);
      expect(reading2?.weightKg).toBe(2.5);
    });

    it('should retain incomplete trailing data while processing previous complete frames', () => {
      const buffer = new StreamBuffer();
      const lines1 = buffer.push('ST,GS,+001.250kg\r\nST,GS,+003');

      expect(lines1).toEqual(['ST,GS,+001.250kg']);
      expect(buffer.getPendingBuffer()).toBe('ST,GS,+003');

      const lines2 = buffer.push('.750kg\r\n');
      expect(lines2).toEqual(['ST,GS,+003.750kg']);
      expect(buffer.getPendingBuffer()).toBe('');
    });
  });

  describe('4. ScaleBridge Serial Hardware Adapter', () => {
    it('should initialize disconnected and connect cleanly', async () => {
      const bridge = new ScaleBridge();
      expect(bridge.isConnected()).toBe(false);

      const connected = await bridge.connect({ baudRate: 9600 });
      expect(connected).toBe(true);
      expect(bridge.isConnected()).toBe(true);

      await bridge.disconnect();
      expect(bridge.isConnected()).toBe(false);
    });

    it('should feed fragmented data chunks and notify registered listeners', async () => {
      const bridge = new ScaleBridge();
      await bridge.connect();

      const readingsReceived: WeightReading[] = [];
      const unsubscribe = bridge.onWeightChange((reading) => {
        readingsReceived.push(reading);
      });

      // Partial chunk 1
      const r1 = bridge.feedData('ST,GS,');
      expect(r1).toHaveLength(0);
      expect(readingsReceived).toHaveLength(0);

      // Partial chunk 2 completes the frame
      const r2 = bridge.feedData('+002.100kg\r\n');
      expect(r2).toHaveLength(1);
      expect(readingsReceived).toHaveLength(1);
      expect(readingsReceived[0].weightKg).toBe(2.1);
      expect(bridge.getLatestReading()?.weightKg).toBe(2.1);

      unsubscribe();
      await bridge.disconnect();
    });

    it('should apply tare offset and reset via zero', async () => {
      const bridge = new ScaleBridge();
      await bridge.connect();

      bridge.feedData('ST,GS,+001.500kg\r\n');
      expect(bridge.getLatestReading()?.weightKg).toBe(1.5);

      // Tare 1.500 kg
      await bridge.tare();
      expect(bridge.getLatestReading()?.weightKg).toBe(0.0);

      // Subsequent gross reading of 3.500 kg yields net 2.000 kg
      bridge.feedData('ST,GS,+003.500kg\r\n');
      expect(bridge.getLatestReading()?.weightKg).toBe(2.0);

      // Reset tare via zero
      await bridge.zero();
      expect(bridge.getLatestReading()?.weightKg).toBe(0.0);

      // Subsequent gross reading of 3.500 kg yields full 3.500 kg
      bridge.feedData('ST,GS,+003.500kg\r\n');
      expect(bridge.getLatestReading()?.weightKg).toBe(3.5);

      await bridge.disconnect();
    });
  });

  describe('5. MockScaleBridge Functionality', () => {
    it('should connect and provide initial zero reading', async () => {
      const mockBridge = new MockScaleBridge();
      expect(mockBridge.isConnected()).toBe(false);

      await mockBridge.connect();
      expect(mockBridge.isConnected()).toBe(true);

      const latest = mockBridge.getLatestReading();
      expect(latest).not.toBeNull();
      expect(latest?.weightKg).toBe(0);
      expect(latest?.isStable).toBe(true);
    });

    it('should set weight and notify listeners with stable or unstable readings', async () => {
      const mockBridge = new MockScaleBridge();
      await mockBridge.connect();

      const updates: WeightReading[] = [];
      mockBridge.onWeightChange((r) => updates.push(r));

      mockBridge.setWeight(3.45, true);
      expect(updates[updates.length - 1].weightKg).toBe(3.45);
      expect(updates[updates.length - 1].isStable).toBe(true);

      mockBridge.setWeight(1.85, false);
      expect(updates[updates.length - 1].weightKg).toBe(1.85);
      expect(updates[updates.length - 1].isStable).toBe(false);

      await mockBridge.disconnect();
      expect(mockBridge.isConnected()).toBe(false);
    });

    it('should properly tare and zero net weight in mock driver', async () => {
      const mockBridge = new MockScaleBridge();
      await mockBridge.connect();

      mockBridge.setWeight(2.0, true);
      expect(mockBridge.getLatestReading()?.weightKg).toBe(2.0);

      await mockBridge.tare();
      expect(mockBridge.getLatestReading()?.weightKg).toBe(0.0);

      // Now set gross weight of 4.5 kg -> net should be 2.5 kg
      mockBridge.setWeight(4.5, true);
      expect(mockBridge.getLatestReading()?.weightKg).toBe(2.5);

      // Zero resets tare offset
      await mockBridge.zero();
      expect(mockBridge.getLatestReading()?.weightKg).toBe(0.0);

      // After zero, setting 4.5 kg yields 4.5 kg
      mockBridge.setWeight(4.5, true);
      expect(mockBridge.getLatestReading()?.weightKg).toBe(4.5);

      await mockBridge.disconnect();
    });
  });
});
