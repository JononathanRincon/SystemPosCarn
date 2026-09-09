export const Platform = {
  OS: 'android',
  select: (objs: any) => objs.android || objs.default,
};

export const StyleSheet = {
  create: <T extends Record<string, any>>(styles: T): T => styles,
};

export const View = 'View';
export const Text = 'Text';
export const Pressable = 'Pressable';
export const TouchableOpacity = 'TouchableOpacity';
export const ScrollView = 'ScrollView';
export const FlatList = 'FlatList';
export const TextInput = 'TextInput';

export const Dimensions = {
  get: () => ({ width: 1280, height: 800 }),
  addEventListener: () => ({ remove: () => {} }),
};

export const NativeModules = {};

export default {
  Platform,
  StyleSheet,
  View,
  Text,
  Pressable,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  Dimensions,
  NativeModules,
};
