// Jest setup file
import '@testing-library/react-native/extend-expect';

// Polyfill for global objects that jest-expo expects
global.window = global.window || {};
global.window.dispatchEvent = global.window.dispatchEvent || (() => {});
global.document = global.document || {};
global.navigator = global.navigator || {};

const ReactNative = require('react-native');
if (!ReactNative.InteractionManager) {
  ReactNative.InteractionManager = {
    runAfterInteractions: (cb) => {
      if (typeof cb === 'function') {
        cb();
      }
      return {
        then: (resolve) => {
          resolve?.();
          return { catch: () => {} };
        },
        catch: () => {},
      };
    },
  };
} else {
  ReactNative.InteractionManager.runAfterInteractions = (cb) => {
    if (typeof cb === 'function') {
      cb();
    }
    return {
      then: (resolve) => {
        resolve?.();
        return { catch: () => {} };
      },
      catch: () => {},
    };
  };
}

// Mock expo-av
jest.mock('expo-av', () => {
  const createAsync = jest.fn(async () => {
    return {
      sound: {
        setOnPlaybackStatusUpdate: (cb) => {
          if (typeof cb === 'function') {
            cb({ isLoaded: true, didJustFinish: true });
          }
        },
        unloadAsync: jest.fn().mockResolvedValue(undefined),
      },
    };
  });

  return {
    Video: 'Video',
    ResizeMode: {
      CONTAIN: 'contain',
      COVER: 'cover',
      STRETCH: 'stretch',
    },
    Audio: {
      Sound: {
        createAsync,
      },
    },
  };
});

// cap fast-check property runs/timeouts to keep suite runtime manageable
const fc = require('fast-check');
const MAX_PROPERTY_RUNS = parseInt(process.env.FC_MAX_RUNS || '20', 10);
const MAX_PROPERTY_TIMEOUT = parseInt(process.env.FC_MAX_TIMEOUT || '6000', 10);

if (fc && typeof fc.assert === 'function') {
  const originalAssert = fc.assert.bind(fc);

  fc.assert = (property, params = {}) => {
    const nextParams = { ...params };
    const requestedRuns = typeof params.numRuns === 'number' ? params.numRuns : undefined;
    nextParams.numRuns =
      requestedRuns !== undefined
        ? Math.min(requestedRuns, MAX_PROPERTY_RUNS)
        : MAX_PROPERTY_RUNS;

    if (params.timeout !== undefined) {
      nextParams.timeout = Math.min(params.timeout, MAX_PROPERTY_TIMEOUT);
    } else {
      nextParams.timeout = MAX_PROPERTY_TIMEOUT;
    }

    return originalAssert(property, nextParams);
  };
}

// Mock expo-camera
jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [
    { granted: true },
    jest.fn(),
  ],
}));

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: jest.fn(),
    runAsync: jest.fn(),
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
  })),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock expo-asset to avoid loading native modules in Jest
jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: jest.fn(() => ({
      downloadAsync: jest.fn().mockResolvedValue(undefined),
      localUri: 'file:///mock/path/model.pte',
    })),
  },
}));

// Mock expo-file-system Directory/File APIs (v19)
jest.mock('expo-file-system', () => {
  class MockDirectory {
    constructor(base, name = '') {
      const normalizedBase = base.startsWith('file://') ? base : `file://${base}`;
      this.uri = `${normalizedBase.replace(/\/$/, '')}${name ? `/${name}` : ''}`;
      this.exists = false;
    }

    async create() {
      this.exists = true;
    }
  }

  class MockFile {
    constructor(base, name) {
      if (typeof base === 'string') {
        this.uri = base.startsWith('file://') ? base : `file://${base}`;
      } else {
        this.uri = `${base.uri.replace(/\/$/, '')}${name ? `/${name}` : ''}`;
      }
      this.exists = typeof base === 'string';
    }

    async copy(destination) {
      destination.exists = true;
      return destination.uri;
    }
  }

  return {
    Paths: {
      document: 'mock-document',
    },
    Directory: MockDirectory,
    File: MockFile,
  };
});
