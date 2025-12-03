const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add wasm support for web
config.resolver.assetExts.push('wasm');

// Add bin support for TensorFlow.js models
config.resolver.assetExts.push('bin');

module.exports = config;
