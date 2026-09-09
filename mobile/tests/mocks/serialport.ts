export const RNSerialport = {
  startService: jest.fn(async () => true),
  stopService: jest.fn(async () => true),
  isOpen: jest.fn(async () => true),
  writeString: jest.fn(async (_str: string) => true),
  writeBytes: jest.fn(async (_bytes: number[]) => true),
  actions: {
    ON_SERVICE_STARTED: 'ON_SERVICE_STARTED',
    ON_SERVICE_STOPPED: 'ON_SERVICE_STOPPED',
    ON_DEVICE_ATTACHED: 'ON_DEVICE_ATTACHED',
    ON_DEVICE_DETACHED: 'ON_DEVICE_DETACHED',
    ON_READ_DATA: 'ON_READ_DATA',
  },
};

export default RNSerialport;
