import { Aioha, KeyTypes, Providers } from '@aioha/aioha';
import type { HiveAuthResult } from '../types/auth';
import { PlaintextKeyProvider } from '@aioha/aioha/build/providers/custom/plaintext.js'
import * as dhive from "@hiveio/dhive";
const client = new dhive.Client(["https://api.hive.blog"]);

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

  static async loginWithPrivatePostingKey(
    aioha: Aioha,
    username: string,
    privatePostingKey: string,
    proof: string,
    privateActiveKey?: string
  ): Promise<HiveAuthResult> {

    try {
      // Validate posting key against on-chain posting authority
      const postingKeyObj = dhive.PrivateKey.fromString(privatePostingKey);
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

      // If an active key is provided, validate it against on-chain active authority (optional)
      let trimmedActiveKey: string | undefined;
      if (privateActiveKey && privateActiveKey.trim()) {
        trimmedActiveKey = privateActiveKey.trim();
        const activeKeyObj = dhive.PrivateKey.fromString(trimmedActiveKey);
        const activePublicKey = activeKeyObj.createPublic().toString();

        const activeKeys = account[0].active.key_auths.map(
          (item: any) => item[0]
        );
        if (!activeKeys.includes(activePublicKey)) {
          throw new Error("Active key mismatch");
        }
      }

      const plaintextProvider = new PlaintextKeyProvider(privatePostingKey);
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
        privatePostingKey: privatePostingKey,
        ...(trimmedActiveKey && { privateActiveKey: trimmedActiveKey })
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

