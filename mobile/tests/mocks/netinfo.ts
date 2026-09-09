type NetInfoState = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type?: string;
};

type NetInfoListener = (state: NetInfoState) => void;

let listeners: NetInfoListener[] = [];
let currentState: NetInfoState = {
  isConnected: true,
  isInternetReachable: true,
  type: 'wifi',
};

export const NetInfo = {
  addEventListener: jest.fn((cb: NetInfoListener) => {
    listeners.push(cb);
    return () => {
      listeners = listeners.filter((l) => l !== cb);
    };
  }),
  fetch: jest.fn(async () => currentState),
  // Test helper
  __simulateChange: (isConnected: boolean, isInternetReachable = isConnected) => {
    currentState = { isConnected, isInternetReachable, type: isConnected ? 'wifi' : 'none' };
    listeners.forEach((cb) => cb(currentState));
  },
  __reset: () => {
    listeners = [];
    currentState = { isConnected: true, isInternetReachable: true, type: 'wifi' };
  },
};

export const useNetInfo = jest.fn(() => currentState);

export default NetInfo;
