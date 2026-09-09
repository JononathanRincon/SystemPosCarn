'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ScaleDriver,
  MockScaleDriver,
  WebSerialScaleDriver,
  WeightReading,
} from './scale-driver';

// Singleton para mantener la conexión activa entre cambios de ruta
let globalScaleDriver: ScaleDriver | null = null;
let isMockMode = true;

export function getGlobalScaleDriver(): ScaleDriver {
  if (!globalScaleDriver) {
    globalScaleDriver = new MockScaleDriver();
    isMockMode = true;
  }
  return globalScaleDriver;
}

export function setGlobalScaleDriver(driver: ScaleDriver, isMock: boolean): void {
  if (globalScaleDriver && globalScaleDriver.isConnected()) {
    globalScaleDriver.disconnect();
  }
  globalScaleDriver = driver;
  isMockMode = isMock;
}

export interface UseScaleReturn {
  weightKg: number;
  isStable: boolean;
  isConnected: boolean;
  isMock: boolean;
  isSignalLost: boolean;
  connectWebSerial: () => Promise<boolean>;
  connectMock: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  zero: () => Promise<void>;
  tare: () => Promise<void>;
  setSimulatedWeight: (kg: number, stable?: boolean) => void;
  getLatestWeight: () => number;
}

export function useScale(): UseScaleReturn {
  const [weightKg, setWeightKg] = useState<number>(0);
  const [isStable, setIsStable] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isMock, setIsMock] = useState<boolean>(isMockMode);
  const [isSignalLost, setIsSignalLost] = useState<boolean>(false);

  const weightRef = useRef<number>(0);

  useEffect(() => {
    const driver = getGlobalScaleDriver();
    setIsConnected(driver.isConnected());
    setIsMock(isMockMode);

    // Conectar automáticamente mock si no está conectado
    if (!driver.isConnected() && isMockMode) {
      driver.connect().then((ok) => {
        setIsConnected(ok);
      });
    }

    const unsubscribe = driver.onWeightChange((reading: WeightReading) => {
      weightRef.current = reading.weightKg;
      setWeightKg(reading.weightKg);
      setIsStable(reading.isStable);
      setIsSignalLost(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const connectWebSerial = useCallback(async () => {
    const serialDriver = new WebSerialScaleDriver({
      onSignalLost: () => setIsSignalLost(true),
    });
    const connected = await serialDriver.connect();
    if (connected) {
      setGlobalScaleDriver(serialDriver, false);
      setIsConnected(true);
      setIsMock(false);
      setIsSignalLost(false);

      serialDriver.onWeightChange((reading) => {
        weightRef.current = reading.weightKg;
        setWeightKg(reading.weightKg);
        setIsStable(reading.isStable);
        setIsSignalLost(false);
      });
      return true;
    }
    return false;
  }, []);

  const connectMock = useCallback(async () => {
    const mockDriver = new MockScaleDriver();
    await mockDriver.connect();
    setGlobalScaleDriver(mockDriver, true);
    setIsConnected(true);
    setIsMock(true);
    setIsSignalLost(false);

    mockDriver.onWeightChange((reading) => {
      weightRef.current = reading.weightKg;
      setWeightKg(reading.weightKg);
      setIsStable(reading.isStable);
      setIsSignalLost(false);
    });
    return true;
  }, []);

  const disconnect = useCallback(async () => {
    const driver = getGlobalScaleDriver();
    await driver.disconnect();
    setIsConnected(false);
    setWeightKg(0);
    weightRef.current = 0;
  }, []);

  const zero = useCallback(async () => {
    const driver = getGlobalScaleDriver();
    await driver.zero();
  }, []);

  const tare = useCallback(async () => {
    const driver = getGlobalScaleDriver();
    await driver.tare();
  }, []);

  const setSimulatedWeight = useCallback((kg: number, stable = true) => {
    const driver = getGlobalScaleDriver();
    if (driver instanceof MockScaleDriver) {
      driver.setWeight(kg, stable);
    }
  }, []);

  const getLatestWeight = useCallback(() => {
    return weightRef.current;
  }, []);

  return {
    weightKg,
    isStable,
    isConnected,
    isMock,
    isSignalLost,
    connectWebSerial,
    connectMock,
    disconnect,
    zero,
    tare,
    setSimulatedWeight,
    getLatestWeight,
  };
}
