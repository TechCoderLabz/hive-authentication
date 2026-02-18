/**
 * Encryption key for local storage (AES). Set by AuthButton via the dotEnv prop.
 */

let encryptionKey: string | undefined;

export function setEncryptionKey(key: string): void {
  encryptionKey = key;
}

export function getEncryptionKey(): string | undefined {
  return encryptionKey;
}
