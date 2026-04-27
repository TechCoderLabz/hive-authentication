import { Aioha, KeyTypes, Providers } from '@aioha/aioha';
import type { HiveAuthResult } from '../types/auth';
import { PlaintextKeyProvider } from '@aioha/aioha/build/providers/custom/plaintext.js'
import * as dhive from "@hiveio/dhive";
const client = new dhive.Client(["https://api.hive.blog"]);

/**
 * Accepts either a WIF private key or a Hive master password and returns
 * the derived private key + its WIF representation. If the input parses as
 * a WIF, it is used as-is; otherwise it is treated as the master password
 * and the key for the given role is derived via `PrivateKey.fromLogin`.
 */
const resolvePrivateKey = (
  input: string,
  username: string,
  role: 'posting' | 'active'
): { keyObj: dhive.PrivateKey; wif: string } => {
  try {
    const keyObj = dhive.PrivateKey.fromString(input);
    return { keyObj, wif: input };
  } catch {
    const keyObj = dhive.PrivateKey.fromLogin(username, input, role);
    return { keyObj, wif: keyObj.toString() };
  }
};

export class AuthService {

  static async loginWithHiveKeychain(aioha: Aioha, username: string, proof: string): Promise<HiveAuthResult> {
    try {
      // Create timestamp for proof
      const timestamp = proof;

      // Login with Hive blockchain using Keychain
      const result = await aioha.login(Providers.Keychain, username, { msg: timestamp, keyType: KeyTypes.Posting });

      if (!result.success) {
        throw new Error(result.error || 'Hive authentication failed');
      }

      return {
        provider: 'keychain',
        challenge: result.result, // Signature result from Hive authentication
        publicKey: result.publicKey || '', // Handle optional publicKey
        username: username,
        proof: timestamp // Original timestamp as proof
      };
    } catch (error) {
      console.error('Hive authentication error:', error);
      throw new Error('Failed to authenticate with Hive blockchain');
    }
  }

  static async loginWithHiveAuth(aioha: Aioha, username: string, proof: string): Promise<HiveAuthResult> {

    try {
      // Create timestamp for proof
      const timestamp = proof;

      // Login with Hive blockchain using HiveAuth
      const result = await aioha.login(Providers.HiveAuth, username, {
        msg: timestamp,
        keyType: KeyTypes.Posting
      });

      if (!result.success) {
        throw new Error(result.error || 'Hive authentication failed');
      }

      return {
        provider: 'hiveauth',
        challenge: result.result, // Signature result from Hive authentication
        publicKey: result.publicKey || '', // Handle optional publicKey
        username: username,
        proof: timestamp // Original timestamp as proof
      };
    } catch (error) {
      console.error('Hive authentication error:', error);
      throw new Error('Failed to authenticate with Hive blockchain');
    }
  }

  static async loginWithHiveSigner(aioha: Aioha, username: string, proof: string): Promise<HiveAuthResult> {
    try {
      const timestamp = proof;

      const result = await aioha.login(Providers.HiveSigner, username, {
        msg: timestamp,
        keyType: KeyTypes.Posting
      });

      if (!result.success) {
        throw new Error(result.error || 'HiveSigner authentication failed');
      }

      return {
        provider: 'hivesigner',
        challenge: result.result,
        publicKey: result.publicKey || '',
        username: result.username || username,
        proof: timestamp
      };
    } catch (error) {
      console.error('HiveSigner authentication error:', error);
      throw new Error('Failed to authenticate with HiveSigner');
    }
  }

  static async loginWithPrivatePostingKey(
    aioha: Aioha,
    username: string,
    privatePostingKey: string,
    proof: string,
    privateActiveKey?: string
  ): Promise<HiveAuthResult> {

    try {
      // Accept either a WIF posting key or the account's master password
      // (in which case the posting key is derived).
      const { keyObj: postingKeyObj, wif: resolvedPostingKey } = resolvePrivateKey(
        privatePostingKey.trim(),
        username,
        'posting'
      );
      const postingPublicKey = postingKeyObj.createPublic().toString();

      const account = await client.database.getAccounts([username]);
      if (account.length === 0) {
        throw new Error(`Account ${username} not found.`);
      }

      const postingKeys = account[0].posting.key_auths.map(
        (item: any) => item[0]
      );
      if (!postingKeys.includes(postingPublicKey)) {
        throw new Error("Posting key mismatch");
      }

      // If an active key (or master password) is provided, validate against
      // on-chain active authority (optional).
      let resolvedActiveKey: string | undefined;
      if (privateActiveKey && privateActiveKey.trim()) {
        const { keyObj: activeKeyObj, wif } = resolvePrivateKey(
          privateActiveKey.trim(),
          username,
          'active'
        );
        resolvedActiveKey = wif;
        const activePublicKey = activeKeyObj.createPublic().toString();

        const activeKeys = account[0].active.key_auths.map(
          (item: any) => item[0]
        );
        if (!activeKeys.includes(activePublicKey)) {
          throw new Error("Active key mismatch");
        }
      }

      const plaintextProvider = new PlaintextKeyProvider(resolvedPostingKey);
      aioha.registerCustomProvider(plaintextProvider);
      // Create timestamp for proof
      const timestamp = proof;

      const result = await aioha.login(Providers.Custom, username, {
        msg: timestamp,
        keyType: KeyTypes.Posting
      });

      if (!result.success) {
        throw new Error(result.error || 'Hive posting key based login failed');
      }

      return {
        provider: 'privatePostingKey',
        challenge: result.result, // Signature result from Hive authentication
        publicKey: result.publicKey || '', // Handle optional publicKey
        username: username,
        proof: timestamp,
        privatePostingKey: resolvedPostingKey,
        ...(resolvedActiveKey && { privateActiveKey: resolvedActiveKey })
      };
    } catch (error) {
      console.error('Hive authentication error:', error);
      throw new Error('Failed to authenticate with Hive blockchain');
    }
  }

  static async switchUserWithPrivatePostingKey(aioha: Aioha, username: string, privatePostingKey: string, proof: string): Promise<HiveAuthResult> {

    try {
      const plaintextProvider = new PlaintextKeyProvider(privatePostingKey);
      aioha.registerCustomProvider(plaintextProvider);
      // Create timestamp for proof
      const timestamp = proof;

      // console.log('Switching to user', username);

      const result = await aioha.login(Providers.Custom, username, {
        msg: timestamp,
        keyType: KeyTypes.Posting
      });

      if (!result.success) {
        throw new Error(result.error || 'Hive posting key based login failed');
      }

      return {
        provider: 'privatePostingKey',
        challenge: result.result, // Signature result from Hive authentication
        publicKey: result.publicKey || '', // Handle optional publicKey
        username: username,
        proof: timestamp,
        privatePostingKey: privatePostingKey
      };
    } catch (error) {
      console.error('Hive authentication error:', error);
      throw new Error('Failed to authenticate with Hive blockchain');
    }
  }

  // Logout the current authenticated user
  static async logout(aioha: Aioha): Promise<void> {
    try {
      await aioha.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  // Remove a specific user from Aioha provider
  static async removeUser(aioha: Aioha, username: string): Promise<unknown> {
    try {
      const result = aioha.removeOtherLogin(username);
      return result;
    } catch (error) {
      console.error('Remove user error:', error);
      throw new Error(`Failed to remove user ${username}`);
    }
  }

  static switchUser(aioha: Aioha, username: string) {
    try {
      aioha.switchUser(username);
    } catch (error) {
      console.error('Switch user error:', error);
      throw new Error(`Failed to switch user to ${username}`);
    }
  }
}

