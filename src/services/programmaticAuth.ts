/* eslint-disable @typescript-eslint/no-explicit-any */
import { Aioha, KeyTypes, Providers } from '@aioha/aioha';
import { PlaintextKeyProvider } from '@aioha/aioha/build/providers/custom/plaintext.js';
import * as dhive from "@hiveio/dhive";
import { useAuthStore } from '../store/authStore';
import type { HiveAuthResult, LoggedInUser } from '../types/auth';

const client = new dhive.Client(["https://api.hive.blog"]);

/**
 * Programmatic authentication service for developers
 * Provides easy-to-use methods for programmatic login without UI components
 */
export class ProgrammaticAuth {
  private aioha: Aioha;

  constructor(aioha: Aioha) {
    this.aioha = aioha;
  }

  /**
   * Login with a private posting key programmatically
   * This method validates the key, authenticates with Hive, and updates the auth store
   * 
   * @param username - The Hive username
   * @param privatePostingKey - The private posting key
   * @param serverCallback - Optional callback to your server for additional validation
   * @returns Promise<LoggedInUser> - The logged-in user object
   * 
   * @example
   * ```typescript
   * import { ProgrammaticAuth } from 'hive-authentication';
   * 
   * const programmaticAuth = new ProgrammaticAuth(aioha);
   * 
   * try {
   *   const user = await programmaticAuth.loginWithPrivateKey(
   *     'username',
   *     '5J...', // private posting key
   *     async (hiveResult) => {
   *       // Your server validation
   *       const response = await fetch('/api/validate', {
   *         method: 'POST',
   *         body: JSON.stringify(hiveResult)
   *       });
   *       return response.json();
   *     }
   *   );
   *   console.log('User logged in:', user.username);
   * } catch (error) {
   *   console.error('Login failed:', error.message);
   * }
   * ```
   */
  async loginWithPrivateKey(
    username: string, 
    privatePostingKey: string,
    serverCallback?: (hiveResult: HiveAuthResult) => Promise<string>
  ): Promise<LoggedInUser> {
    try {
      // Validate the private key format
      const privateKeyObj = dhive.PrivateKey.fromString(privatePostingKey);
      const publicKey = privateKeyObj.createPublic().toString();

      // Verify the account exists and the key is valid
      const account = await client.database.getAccounts([username]);
      if (account.length === 0) {
        throw new Error(`Account ${username} not found.`);
      }

      const postingKeys = account[0].posting.key_auths.map(
        (item: any) => item[0]
      );
      if (!postingKeys.includes(publicKey)) {
        throw new Error("Private posting key does not match the account's posting authority");
      }

      // Set up the custom provider
      const plaintextProvider = new PlaintextKeyProvider(privatePostingKey);
      this.aioha.registerCustomProvider(plaintextProvider);

      // Create timestamp for proof
      const timestamp = new Date().toISOString();

      // Authenticate with Hive
      const result = await this.aioha.login(Providers.Custom, username, {
        msg: timestamp,
        keyType: KeyTypes.Posting
      });

      if (!result.success) {
        throw new Error(result.error || 'Hive posting key based login failed');
      }

      // Create the Hive auth result
      const hiveResult: HiveAuthResult = {
        provider: 'privatePostingKey',
        challenge: result.result,
        publicKey: result.publicKey || '',
        username: username,
        proof: timestamp,
        privatePostingKey: privatePostingKey
      };

      // If server callback is provided, use the store's authenticateWithCallback
      if (serverCallback) {
        const authStore = useAuthStore.getState();
        await authStore.authenticateWithCallback(hiveResult, serverCallback);
        return useAuthStore.getState().currentUser!;
      } else {
        // Create user object without server validation
        const user: LoggedInUser = {
          username: hiveResult.username,
          provider: hiveResult.provider,
          challenge: hiveResult.challenge,
          publicKey: hiveResult.publicKey,
          proof: hiveResult.proof,
          serverResponse: JSON.stringify({ message: 'No server validation performed' }),
          privatePostingKey: hiveResult.privatePostingKey,
        };

        // Add to store
        const authStore = useAuthStore.getState();
        authStore.addLoggedInUser(user);
        authStore.setCurrentUser(user);

        return user;
      }
    } catch (error) {
      console.error('Programmatic login error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to authenticate with private key');
    }
  }
}
