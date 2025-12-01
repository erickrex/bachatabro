const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add wasm support for web
config.resolver.assetExts.push('wasm');

module.exports = config;
