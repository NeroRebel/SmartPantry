const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
if (!config.resolver.assetExts.includes('wasm')) config.resolver.assetExts.push('wasm');

// Expo SQLite's web worker needs SharedArrayBuffer; native builds are unaffected.
const enhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const enhanced = enhanceMiddleware ? enhanceMiddleware(middleware, server) : middleware;
  return (request, response, next) => {
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    return enhanced(request, response, next);
  };
};

module.exports = config;
