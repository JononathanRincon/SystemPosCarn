import {
  parseWeight,
  StreamBuffer,
  ScaleBridge,
  MockScaleBridge,
  WeightReading,
} from '../src/services/ScaleBridge';
import { SyncWorker, generateUUID } from '../src/services/SyncWorker';
import { Database, Q } from '@nozbe/watermelondb';
import { createTestDatabase } from './helpers/test-db';
import { VentaOutbox } from '../src/database/models/VentaOutbox';
import NetInfo from '@react-native-community/netinfo';

describe('Adversarial Stress-Testing Suite: ScaleBridge & SyncWorker (Bloque 13)', () => {
  let database: Database;

  beforeEach(async () => {
    database = createTestDatabase();
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
    // @ts-ignore
    NetInfo.__reset();
  });

  describe('Part 1: Adversarial Stress Testing — ScaleBridge & parseWeight', () => {
    describe('1.1 Malformed, Extreme, and Boundary Frame Inputs', () => {
      it('should handle null, undefined, and non-string inputs gracefully without throwing', () => {
        // @ts-ignore
        expect(parseWeight(null)).toBeNull();
        // @ts-ignore
        expect(parseWeight(undefined)).toBeNull();
        // @ts-ignore
        expect(parseWeight(12345)).toBeNull();
        // @ts-ignore
        expect(parseWeight({})).toBeNull();
        // @ts-ignore
        expect(parseWeight([])).toBeNull();
      });

      it('should reject empty, whitespace-only, and control-character-only frames', () => {
        expect(parseWeight('')).toBeNull();
        expect(parseWeight('   ')).toBeNull();
        expect(parseWeight('\r\n\t  \r\n')).toBeNull();
        expect(parseWeight('\x00\x01\x02\x03\x04\x05\r\n')).toBeNull();
      });

      it('should reject known hardware status/error frames', () => {
        expect(parseWeight('ERROR\r\n')).toBeNull();
        expect(parseWeight('ERR')).toBeNull();
        expect(parseWeight('ACK\r\n')).toBeNull();
        expect(parseWeight('NAK\r\n')).toBeNull();
        expect(parseWeight('?\r\n')).toBeNull();
        expect(parseWeight('SYN')).toBeNull();
      });

      it('should handle emoji, binary noise, and unicode corruptions without throwing', () => {
        expect(parseWeight('ST,GS,+🥩🥩🥩kg\r\n')).toBeNull();
        expect(parseWeight('\xFF\xFE\x00\x01')).toBeNull();
        expect(parseWeight('CORRUPT_PACKET_$%^&*()')).toBeNull();
      });

      it('should safely extract numbers surrounded by heavy leading/trailing whitespace and tabs', () => {
        const frame = '\t\t  \r\n   ST,GS,+   4.567   kg   \r\n\t  ';
        const reading = parseWeight(frame);
        expect(reading).not.toBeNull();
        expect(reading?.weightKg).toBe(4.567);
        expect(reading?.isStable).toBe(true);
        expect(reading?.isValid).toBe(true);
      });

      it('should handle unexpected delimiters (semicolons, colons, pipes)', () => {
        const pipeFrame = 'ST|GS|2.345|KG\r\n';
        const readingPipe = parseWeight(pipeFrame);
        expect(readingPipe).not.toBeNull();
        expect(readingPipe?.weightKg).toBe(2.345);

        const semiFrame = 'ST;GS;+1.789;kg\r\n';
        const readingSemi = parseWeight(semiFrame);
        expect(readingSemi).not.toBeNull();
        expect(readingSemi?.weightKg).toBe(1.789);
      });

      it('should handle zero-padded integer portions without overflow', () => {
        const frame = 'ST,GS,+000000000000000000000001.250kg\r\n';
        const reading = parseWeight(frame);
        expect(reading).not.toBeNull();
        expect(reading?.weightKg).toBe(1.25);
      });

      it('should handle sub-milligram weights and round to 3 decimals', () => {
        const readingSubGram1 = parseWeight('ST,GS,+0.0001kg\r\n');
        expect(readingSubGram1?.weightKg).toBe(0.000);
        expect(readingSubGram1?.isZero).toBe(true);
        expect(readingSubGram1?.isValid).toBe(false);

        const readingSubGram9 = parseWeight('ST,GS,+0.0009kg\r\n');
        expect(readingSubGram9?.weightKg).toBe(0.001);
        expect(readingSubGram9?.isZero).toBe(false);
        expect(readingSubGram9?.isValid).toBe(true);
      });

      it('should handle extreme positive numbers without crash or NaN', () => {
        const largeFrame = 'ST,GS,+999999999.999kg\r\n';
        const reading = parseWeight(largeFrame);
        expect(reading).not.toBeNull();
        expect(reading?.weightKg).toBe(999999999.999);
        expect(reading?.isValid).toBe(true);
        expect(reading?.isZero).toBe(false);
      });

      it('should handle extreme negative numbers and enforce isZero guard', () => {
        const negativeFrame = 'ST,GS,-99999.999kg\r\n';
        const reading = parseWeight(negativeFrame);
        expect(reading).not.toBeNull();
        expect(reading?.weightKg).toBe(-99999.999);
        expect(reading?.isZero).toBe(true);
        expect(reading?.isValid).toBe(false);
      });

      it('should observe behavior on frames with multiple numbers or metadata prefixes', () => {
        // When frame contains metadata numbers before weight, e.g. "SCALE #2: 3.450kg"
        const frameWithPrefix = 'SCALE#2: 3.450kg\r\n';
        const reading = parseWeight(frameWithPrefix);
        // Empirical check: regex extracts first match
        expect(reading).not.toBeNull();
        // Since regex matches first number group, it extracts 2, not 3.450
        expect(reading?.weightKg).toBe(2);
      });

      it('should observe behavior on comma decimal separator', () => {
        // Torrey/Systel scales in Spanish locales might output "ST,GS,+001,250kg\r\n"
        const commaFrame = 'ST,GS,+001,250kg\r\n';
        const reading = parseWeight(commaFrame);
        expect(reading).not.toBeNull();
        // Since regex expects dot, it matches +001
        expect(reading?.weightKg).toBe(1);
      });
    });

    describe('1.2 Strict 3-Decimal Precision & Floating Point Artifact Immunity', () => {
      it('should never produce JavaScript floating point artifact 0.30000000000000004 for 0.1 + 0.2', () => {
        const floatTrap = 0.1 + 0.2; // 0.30000000000000004
        expect(floatTrap).not.toBe(0.3);

        const frame = `ST,GS,+${floatTrap}kg\r\n`;
        const reading = parseWeight(frame);
        expect(reading).not.toBeNull();
        expect(reading?.weightKg).toBe(0.3);

        // Verify string representation does not contain IEEE-754 tail
        const strVal = reading?.weightKg.toString();
        expect(strVal).not.toContain('00000000000004');
        expect(strVal).toBe('0.3');
      });

      it('should never produce floating point artifact for 0.1 + 0.7 (0.7999999999999999)', () => {
        const floatTrap = 0.1 + 0.7; // 0.7999999999999999
        const frame = `ST,GS,+${floatTrap}kg\r\n`;
        const reading = parseWeight(frame);
        expect(reading).not.toBeNull();
        expect(reading?.weightKg).toBe(0.8);
      });

      it('should handle standard midpoint rounding values correctly (1.005, 2.0005)', () => {
        const r1 = parseWeight('1.005\r\n');
        expect(r1?.weightKg).toBe(1.005);

        const r2 = parseWeight('2.0005\r\n');
        // 2.0005 rounded to 3 decimals is 2.001 (or 2.000 depending on IEEE rounding)
        expect([2.000, 2.001]).toContain(r2?.weightKg);
      });

      it('stress: randomized generator of 1000 weight frames never produces > 3 decimal places', () => {
        for (let i = 0; i < 1000; i++) {
          const rawNum = Math.random() * 50; // 0 to 50 kg
          const frame = `ST,GS,+${rawNum}kg\r\n`;
          const reading = parseWeight(frame);
          expect(reading).not.toBeNull();

          const w = reading!.weightKg;
          expect(Number.isFinite(w)).toBe(true);
          expect(Number.isNaN(w)).toBe(false);

          // Test decimal place count
          const parts = w.toString().split('.');
          if (parts.length > 1) {
            expect(parts[1].length).toBeLessThanOrEqual(3);
          }

          // Exact 3-decimal integer test: w * 1000 should be integer
          const multiplied = Math.round(w * 1000);
          expect(Math.abs(w * 1000 - multiplied)).toBeLessThan(1e-9);
        }
      });
    });

    describe('1.3 StreamBuffer Fragmentation & Byte Stream Stress', () => {
      it('should accurately reassemble frames transmitted 1 single byte at a time', () => {
        const streamBuffer = new StreamBuffer();
        const payload = 'ST,GS,+001.250kg\r\nST,GS,+002.500kg\r\nST,GS,+003.750kg\r\n';
        const gatheredFrames: string[] = [];

        for (let i = 0; i < payload.length; i++) {
          const char = payload[i];
          const frames = streamBuffer.push(char);
          gatheredFrames.push(...frames);
        }

        expect(gatheredFrames).toHaveLength(3);
        expect(gatheredFrames[0]).toBe('ST,GS,+001.250kg');
        expect(gatheredFrames[1]).toBe('ST,GS,+002.500kg');
        expect(gatheredFrames[2]).toBe('ST,GS,+003.750kg');
        expect(streamBuffer.getPendingBuffer()).toBe('');
      });

      it('should reassemble chunks split exactly across the CR-LF boundary', () => {
        const streamBuffer = new StreamBuffer();
        const chunk1 = 'ST,GS,+001.250kg\r';
        const chunk2 = '\nST,GS,+002.500kg\r\n';

        const frames1 = streamBuffer.push(chunk1);
        const frames2 = streamBuffer.push(chunk2);

        const allFrames = [...frames1, ...frames2];
        expect(allFrames).toHaveLength(2);
        expect(allFrames[0]).toBe('ST,GS,+001.250kg');
        expect(allFrames[1]).toBe('ST,GS,+002.500kg');
      });

      it('should reassemble chunks split in the middle of decimal numbers', () => {
        const streamBuffer = new StreamBuffer();
        const frames1 = streamBuffer.push('ST,GS,+004.');
        expect(frames1).toHaveLength(0);
        expect(streamBuffer.getPendingBuffer()).toBe('ST,GS,+004.');

        const frames2 = streamBuffer.push('892kg\r\n');
        expect(frames2).toHaveLength(1);
        expect(frames2[0]).toBe('ST,GS,+004.892kg');

        const reading = parseWeight(frames2[0]);
        expect(reading?.weightKg).toBe(4.892);
      });

      it('should process burst of 100 frames in a single chunk', () => {
        const streamBuffer = new StreamBuffer();
        let bigChunk = '';
        for (let i = 1; i <= 100; i++) {
          bigChunk += `ST,GS,+${(i * 0.1).toFixed(3)}kg\r\n`;
        }

        const frames = streamBuffer.push(bigChunk);
        expect(frames).toHaveLength(100);
        expect(frames[0]).toBe('ST,GS,+0.100kg');
        expect(frames[99]).toBe('ST,GS,+10.000kg');
      });

      it('should measure unbounded memory growth when feeding bytes without delimiters', () => {
        const streamBuffer = new StreamBuffer();
        const noDelimiterChunk = 'A'.repeat(10000);
        const frames = streamBuffer.push(noDelimiterChunk);
        expect(frames).toHaveLength(0);
        expect(streamBuffer.getPendingBuffer().length).toBe(10000);
      });
    });

    describe('1.4 MockScaleBridge Tare and Zero Logic Stress', () => {
      it('should correctly tare positive weight and deduct tare offset from future readings', async () => {
        const bridge = new MockScaleBridge();
        await bridge.connect();

        // Place container of 0.450 kg
        bridge.setWeight(0.450, true);
        expect(bridge.getLatestReading()?.weightKg).toBe(0.450);

        // Press Tare
        await bridge.tare();
        expect(bridge.getLatestReading()?.weightKg).toBe(0.000);
        expect(bridge.getLatestReading()?.isZero).toBe(true);

        // Add meat of 1.250 kg (gross 1.700 kg)
        bridge.setWeight(1.700, true);
        // Net weight should be exactly 1.700 - 0.450 = 1.250 kg
        expect(bridge.getLatestReading()?.weightKg).toBe(1.250);
        expect(bridge.getLatestReading()?.isValid).toBe(true);

        await bridge.disconnect();
      });

      it('should clamp negative net weight to 0.000 when weight on scale is less than tare offset', async () => {
        const bridge = new MockScaleBridge();
        await bridge.connect();

        // Place container of 0.800 kg and tare
        bridge.setWeight(0.800, true);
        await bridge.tare();
        expect(bridge.getLatestReading()?.weightKg).toBe(0.000);

        // Remove container (scale raw weight drops to 0.100 or 0.000)
        bridge.setWeight(0.000, true);
        // Net raw would be 0.000 - 0.800 = -0.800 kg.
        // Empirical observation: MockScaleBridge clamps Math.max(0, netRaw)
        expect(bridge.getLatestReading()?.weightKg).toBe(0.000);
        expect(bridge.getLatestReading()?.isZero).toBe(true);

        await bridge.disconnect();
      });

      it('should reset tare offset completely when zero() is invoked', async () => {
        const bridge = new MockScaleBridge();
        await bridge.connect();

        // Tare container of 0.500 kg
        bridge.setWeight(0.500, true);
        await bridge.tare();

        // Reset with zero()
        await bridge.zero();
        expect(bridge.getLatestReading()?.weightKg).toBe(0.000);

        // Now place 0.500 kg: it should read full 0.500 kg without tare offset
        bridge.setWeight(0.500, true);
        expect(bridge.getLatestReading()?.weightKg).toBe(0.500);

        await bridge.disconnect();
      });

      it('should support multiple concurrent listeners and clean unsubscription', async () => {
        const bridge = new MockScaleBridge();
        await bridge.connect();

        const readings1: WeightReading[] = [];
        const readings2: WeightReading[] = [];

        const unsub1 = bridge.onWeightChange((r) => readings1.push(r));
        const unsub2 = bridge.onWeightChange((r) => readings2.push(r));

        bridge.setWeight(1.100);
        bridge.setWeight(2.200);

        expect(readings1.length).toBeGreaterThanOrEqual(2);
        expect(readings2.length).toBeGreaterThanOrEqual(2);

        // Unsubscribe first listener
        unsub1();
        bridge.setWeight(3.300);

        expect(readings1[readings1.length - 1].weightKg).toBe(2.200);
        expect(readings2[readings2.length - 1].weightKg).toBe(3.300);

        unsub2();
        await bridge.disconnect();
      });
    });
  });

  describe('Part 2: Adversarial Stress Testing — SyncWorker', () => {
    describe('2.1 Rapid Network Flapping (offline -> online -> offline)', () => {
      it('should survive rapid continuous flapping without unhandled rejections or race corruption', async () => {
        // Start offline
        // @ts-ignore
        NetInfo.__simulateChange(false, false);

        let fetchCallCount = 0;
        const mockFetch = jest.fn().mockImplementation(async () => {
          fetchCallCount++;
          // Simulate network latency of 20ms
          await new Promise((res) => setTimeout(res, 20));
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ procesadas: 1 }),
          };
        });

        const worker = new SyncWorker({
          database,
          autoStart: true,
          fetchFn: mockFetch as any,
        });

        // Enqueue 5 sales
        for (let i = 1; i <= 5; i++) {
          await worker.enqueueSale({ total: i * 10000, items: [] });
        }

        expect(await worker.getPendingCount()).toBe(5);

        // Flap 20 times rapidly (offline -> online -> offline)
        for (let i = 0; i < 20; i++) {
          // @ts-ignore
          NetInfo.__simulateChange(i % 2 === 0, i % 2 === 0);
        }

        // Settle network to online
        // @ts-ignore
        NetInfo.__simulateChange(true, true);

        // Wait for any pending async syncs to settle
        await new Promise((res) => setTimeout(res, 150));

        // Call explicit sync to verify recovery
        await worker.syncPendingSales();

        // Verify all 5 sales were synced eventually
        expect(await worker.getPendingCount()).toBe(0);

        worker.destroy();
      });
    });

    describe('2.2 Concurrency Stress & Mutual Exclusion Guard', () => {
      it('should enforce concurrency lock: parallel calls to syncPendingSales() must not duplicate HTTP requests', async () => {
        let activeHttpRequests = 0;
        let maxConcurrentHttpRequests = 0;
        let totalHttpCalls = 0;

        const mockFetch = jest.fn().mockImplementation(async () => {
          totalHttpCalls++;
          activeHttpRequests++;
          if (activeHttpRequests > maxConcurrentHttpRequests) {
            maxConcurrentHttpRequests = activeHttpRequests;
          }
          // Hold request for 30ms to simulate network transit
          await new Promise((resolve) => setTimeout(resolve, 30));
          activeHttpRequests--;

          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ status: 'success' }),
          };
        });

        const worker = new SyncWorker({
          database,
          autoStart: false,
          fetchFn: mockFetch as any,
        });

        // Enqueue 3 sales
        await worker.enqueueSale({ total: 15000 });
        await worker.enqueueSale({ total: 25000 });
        await worker.enqueueSale({ total: 35000 });

        expect(await worker.getPendingCount()).toBe(3);

        // Fire 15 concurrent calls to syncPendingSales() at the exact same instant
        const promises = Array.from({ length: 15 }, () => worker.syncPendingSales());
        const results = await Promise.all(promises);

        // Exactly 1 call should have acquired the sync lock and performed the HTTP request
        expect(maxConcurrentHttpRequests).toBe(1);
        expect(totalHttpCalls).toBe(1);

        // Exactly one call reports syncedCount = 3, while the others returned { syncedCount: 0, failedCount: 0 }
        const nonZeroResults = results.filter((r) => r.syncedCount > 0);
        expect(nonZeroResults).toHaveLength(1);
        expect(nonZeroResults[0].syncedCount).toBe(3);

        // Final pending count in database must be 0
        expect(await worker.getPendingCount()).toBe(0);

        worker.destroy();
      });
    });

    describe('2.3 Idempotency Headers & Batch Payload Verification', () => {
      it('should supply single UUID as Idempotency-Key for batch of 1', async () => {
        let sentHeaders: any = null;
        let sentBody: any = null;

        const mockFetch = jest.fn().mockImplementation(async (_url, opts) => {
          sentHeaders = opts.headers;
          sentBody = JSON.parse(opts.body);
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ ok: true }),
          };
        });

        const worker = new SyncWorker({
          database,
          autoStart: false,
          fetchFn: mockFetch as any,
        });

        const saleRecord = await worker.enqueueSale({ total: 50000 });
        await worker.syncPendingSales();

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(sentHeaders['Idempotency-Key']).toBe(saleRecord.id);
        expect(sentBody.ventas).toHaveLength(1);
        expect(sentBody.ventas[0].id).toBe(saleRecord.id);

        worker.destroy();
      });

      it('should supply comma-separated UUIDs as Idempotency-Key for batch > 1', async () => {
        let sentHeaders: any = null;
        let sentBody: any = null;

        const mockFetch = jest.fn().mockImplementation(async (_url, opts) => {
          sentHeaders = opts.headers;
          sentBody = JSON.parse(opts.body);
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ ok: true }),
          };
        });

        const worker = new SyncWorker({
          database,
          autoStart: false,
          batchSize: 5,
          fetchFn: mockFetch as any,
        });

        const r1 = await worker.enqueueSale({ total: 10000 });
        const r2 = await worker.enqueueSale({ total: 20000 });

        await worker.syncPendingSales();

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const keys = (sentHeaders['Idempotency-Key'] as string).split(',');
        expect(keys).toHaveLength(2);
        expect(keys).toContain(r1.id);
        expect(keys).toContain(r2.id);
        expect(sentBody.ventas).toHaveLength(2);

        worker.destroy();
      });

      it('should handle corrupted or non-JSON payloads gracefully without worker crash', async () => {
        let sentBody: any = null;
        const mockFetch = jest.fn().mockImplementation(async (_url, opts) => {
          sentBody = JSON.parse(opts.body);
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ ok: true }),
          };
        });

        const worker = new SyncWorker({
          database,
          autoStart: false,
          fetchFn: mockFetch as any,
        });

        // Insert a corrupted record directly into WatermelonDB
        await database.write(async () => {
          await database.get<VentaOutbox>('ventas_outbox').create((outbox) => {
            outbox.payload = 'INVALID_JSON_CORRUPTED_DATA{{{';
            outbox.status = 'pending';
            outbox.retryCount = 0;
            outbox.errorMessage = null;
          });
        });

        const res = await worker.syncPendingSales();
        expect(res.syncedCount).toBe(1);
        expect(sentBody.ventas[0].raw).toBe('INVALID_JSON_CORRUPTED_DATA{{{');

        worker.destroy();
      });
    });

    describe('2.4 Network Abort, Timeout, and HTTP 5xx / 4xx Failure Handling', () => {
      it('should keep status as pending and increment retry_count upon network AbortError', async () => {
        const mockFetch = jest.fn().mockRejectedValue(new Error('The operation was aborted.'));

        const worker = new SyncWorker({
          database,
          autoStart: false,
          fetchFn: mockFetch as any,
        });

        const sale = await worker.enqueueSale({ total: 12000 });
        const result = await worker.syncPendingSales();

        expect(result.syncedCount).toBe(0);
        expect(result.failedCount).toBe(1);

        // Verify database record state
        const updated = await database.get<VentaOutbox>('ventas_outbox').find(sale.id);
        expect(updated.status).toBe('pending');
        expect(updated.retryCount).toBe(1);
        expect(updated.errorMessage).toContain('aborted');
        expect(updated.syncedAt).toBeNull();

        worker.destroy();
      });

      it('should increment retry_count across consecutive 500 Internal Server Errors', async () => {
        const mockFetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

        const worker = new SyncWorker({
          database,
          autoStart: false,
          fetchFn: mockFetch as any,
        });

        const sale = await worker.enqueueSale({ total: 15000 });

        // First attempt -> retry_count = 1
        await worker.syncPendingSales();
        let record = await database.get<VentaOutbox>('ventas_outbox').find(sale.id);
        expect(record.status).toBe('pending');
        expect(record.retryCount).toBe(1);
        expect(record.errorMessage).toContain('HTTP error 500');

        // Second attempt -> retry_count = 2
        await worker.syncPendingSales();
        record = await database.get<VentaOutbox>('ventas_outbox').find(sale.id);
        expect(record.status).toBe('pending');
        expect(record.retryCount).toBe(2);

        // Third attempt recovers with 200 OK -> status becomes synced
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({}),
        });

        await worker.syncPendingSales();
        record = await database.get<VentaOutbox>('ventas_outbox').find(sale.id);
        expect(record.status).toBe('synced');
        expect(record.syncedAt).not.toBeNull();
        expect(record.errorMessage).toBeNull();

        worker.destroy();
      });

      it('should observe behavior when HTTP 400 Bad Request is returned (poison pill analysis)', async () => {
        const mockFetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
        });

        const worker = new SyncWorker({
          database,
          autoStart: false,
          fetchFn: mockFetch as any,
        });

        const sale = await worker.enqueueSale({ total: -999 }); // invalid business data
        const result = await worker.syncPendingSales();

        expect(result.failedCount).toBe(1);

        const record = await database.get<VentaOutbox>('ventas_outbox').find(sale.id);
        // Current behavior: preserves 'pending' status without dead-letter marking
        expect(record.status).toBe('pending');
        expect(record.retryCount).toBe(1);
        expect(record.errorMessage).toContain('HTTP error 400');

        worker.destroy();
      });
    });
  });
});
