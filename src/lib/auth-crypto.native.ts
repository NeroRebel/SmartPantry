import { CryptoDigestAlgorithm, digest, getRandomValues } from 'expo-crypto';

// Supabase PKCE uses WebCrypto. Supply Expo's secure random/SHA-256 primitives on native.
const nativeCrypto = globalThis.crypto ?? {} as Crypto;
if (!nativeCrypto.getRandomValues) nativeCrypto.getRandomValues = getRandomValues as Crypto['getRandomValues'];
if (!nativeCrypto.subtle) {
  Object.defineProperty(nativeCrypto, 'subtle', { configurable: true, value: {
    async digest(algorithm: AlgorithmIdentifier, data: BufferSource) {
      const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
      if (name.toUpperCase() !== 'SHA-256') throw new Error('Unsupported authentication digest');
      return digest(CryptoDigestAlgorithm.SHA256, data);
    },
  } });
}
if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: nativeCrypto, configurable: true });
