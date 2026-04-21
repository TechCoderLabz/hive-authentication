# Hive Authentication

A React package for Hive blockchain authentication with a simple callback-based API and Zustand state management.

## Installation

```bash
npm install hive-authentication
```

## Quick Start

### 1. Import CSS

```tsx
import 'hive-authentication/build.css';
```

### 2. Use the Auth Button with Callback

```tsx
import { AuthButton, useAuthStore } from 'hive-authentication';

import { initAioha } from '@aioha/aioha'
import { AiohaProvider } from '@aioha/react-provider'

const aioha = initAioha(
  {
    hivesigner: {
      app: 'hive-auth-demo.app',
      callbackURL: window.location.origin + '/hivesigner.html',
      scope: ['login', 'vote']
    },
    hiveauth: {
      name: 'Hive Authentication Demo',
      description: 'A demo app for testing Hive authentication'
    }
  }
)

function App() {
  const { currentUser, loggedInUsers } = useAuthStore();

  // Subscribe to store changes using Zustand
  useEffect(() => {
    const unsubscribe = useAuthStore.subscribe((state) => {
      console.log('Store state changed:', state);
    });

    return unsubscribe;
  }, []);

  // Your Hive authentication callback - works for both login AND adding accounts
  const handleAuthenticate = async (hiveResult) => {
    // Make your API call here
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challenge: hiveResult.challenge,
        username: hiveResult.username,
        pubkey: hiveResult.publicKey,
        proof: hiveResult.proof,
      }),
    });

    if (!response.ok) {
      throw new Error('Server authentication failed');
    }

    const data = await response.json();
    
    // Return your server response as JSON string
    return JSON.stringify(data);
  };

  // Optional Web2 callback (Google / Email)
  const handleWeb2Authenticate = async (web2Result) => {
    const response = await fetch('/api/web2-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(web2Result),
    });
    if (!response.ok) {
      throw new Error('Web2 authentication failed');
    }
    const data = await response.json();
    return JSON.stringify(data);
  };

  return (
    <AiohaProvider aioha={aioha}>
      <div>
        <h1>My App</h1>
          <AuthButton
            encryptionKey={import.meta.env.VITE_APP_ENCRYPTION_KEY || 'your-secure-encryption-key'}
            onAuthenticate={handleAuthenticate}
            aioha={aioha}
            shouldShowSwitchUser={true}
            isActiveFieldVisible={false}
            onClose={() => {
              console.log("AuthButton dialog closed");
            }}
            onSignMessage={(username) => {
              return `${new Date().toISOString()}:${username}`;
            }}
            web2Config={import.meta.env.VITE_FIREBASE_CONFIG ? JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG) : undefined}
            onWeb2Authenticate={handleWeb2Authenticate}
            theme={"light"}
          />
          
          {currentUser && (
            <p>Welcome, {currentUser.username}!</p>
          )}
      </div>
    </AiohaProvider>
  );
}
```

### Programmatic login for private posting key

```
import { useProgrammaticAuth } from "./hooks/useProgrammaticAuth";

function YouComponent() {
  const { loginWithPrivateKey } = useProgrammaticAuth(aioha);

  const handleProgrammaticLogin = async () => {
    const userInfo = await loginWithPrivateKey(user, key, async (hiveResult) => {
      console.log("Hive result:", hiveResult);
      // TODO: Add server validation
      return JSON.stringify({ message: "Server validation successful" });
    });
    console.log("User logged in:", userInfo);
  };

  return (
    <div>
      <button onClick={handleProgrammaticLogin} className="btn btn-primary">
        Programmatic Login
      </button>
    </div>
  );
}
```

---

**Private key login (optional Active Key)**  
When users choose "Private Key" login, they enter a **Posting Key** (required). You can optionally show an **Active Key** field by passing `isActiveFieldVisible={true}` to `AuthButton`. If provided, the active key is validated against the account’s active authority and included in `hiveResult.privateActiveKey` and in the stored user. It is never required for login.

**Note**: Both configurations are required even if you only plan to use one provider. This ensures the Aioha library is properly initialized with all necessary settings.

**HiveAuth Support**: The package now fully supports HiveAuth login! When using HiveAuth:

1. **Event Listening**: The package automatically listens for `hiveauth_login_request` events from the Aioha library
2. **QR Code Display**: When a HiveAuth login request is received, a QR code is displayed for the user to scan
3. **Wallet Integration**: Users can scan the QR code with their HiveAuth wallet app to approve the login
4. **Automatic Handling**: The package handles the entire flow from login request to authentication completion

**HiveSigner Support**: HiveSigner is supported as an opt-in provider. Pass `hiveSignerVisible` to `AuthButton` and mount the exported `HiveSignerCallback` at the route you configured as `hivesigner.callbackURL`. See the dedicated **HiveSigner Integration** section below for the full setup.

## How It Works

1. **User clicks login** → Package shows login modal
2. **User enters username** → Package authenticates with Hive blockchain
3. **Package calls your callback** → Your app makes API call to your server
4. **Your app returns result** → Package stores the data and updates state
5. **If callback fails** → Package automatically logs out the user

**Important**: The same callback function is used for:
- **Initial login** (when user first logs in)
- **Adding accounts** (when user clicks "Add Account" in the switch user modal)

This ensures consistent authentication flow for all user operations.

## HiveAuth Login Flow

When a user chooses HiveAuth login:

1. **Login Request**: User clicks "Login with HiveAuth" button
2. **Event Emission**: Aioha library emits a `hiveauth_login_request` event
3. **Form Hiding**: Login form (username input and buttons) is automatically hidden
4. **QR Code Generation**: Package generates a QR code from the HiveAuth payload
5. **QR Code Display**: Large, scannable QR code is displayed with 30-second countdown timer
6. **Wallet Scan**: User scans QR code with their HiveAuth wallet app
7. **Wallet Approval**: User approves the login in their wallet
8. **Authentication Complete**: Package receives the authentication result and proceeds with your callback
9. **Timer Expiry**: If 30 seconds pass without approval, QR code expires and login form reappears

**Key Features:**
- **Automatic Form Hiding**: Login form disappears when QR code is shown
- **Real QR Code**: Actual QR code generated from HiveAuth payload (not placeholder)
- **30-Second Timer**: Countdown timer with automatic expiry
- **Cancel Option**: User can manually cancel QR code display
- **Seamless UX**: Smooth transition between login form and QR code display

## HiveSigner Integration

HiveSigner is an OAuth-style provider: the user is redirected to `hivesigner.com` to approve your app, then bounced back to a callback URL in your app. Because of that redirect step, enabling it needs a little more wiring than the other providers.

### 1. Configure Aioha

Pass a `hivesigner` block to `initAioha`. The `callbackURL` must be a route **inside your app** — this is where HiveSigner will send the user back with the access token.

```ts
import { initAioha } from '@aioha/aioha'

export const aioha = initAioha({
  hivesigner: {
    app: 'your-app-name',                                           // registered on hivesigner.com
    callbackURL: window.location.origin + '/#/hivesignerlogin',     // must match a route you mount below
    scope: ['login', 'vote'],
  },
  hiveauth: {
    name: 'My App',
    description: 'My App description',
  },
})
```

Notes:
- `scope` — minimum `['login']`. Add broadcast scopes (e.g. `'vote'`, `'comment'`, `'transfer'`) only if your app needs them.
- The `#/hivesignerlogin` form is for hash-router apps. If you use `BrowserRouter`, drop the `#/` and use `/hivesignerlogin`.
- Register your `app` name and the exact `callbackURL` on [hivesigner.com](https://hivesigner.com/) before testing.

### 2. Mount the callback route

The package exports a ready-made `HiveSignerCallback` component that processes the token and closes/redirects the window. Mount it at the same path you passed as `callbackURL`.

```tsx
// main.tsx (hash router example — matches `#/hivesignerlogin`)
import { HashRouter, Route, Routes } from 'react-router-dom'
import { HiveSignerCallback } from 'hive-authentication'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/hivesignerlogin" element={<HiveSignerCallback />} />
    </Routes>
  </HashRouter>,
)
```

For `BrowserRouter`, swap `HashRouter` for `BrowserRouter` and use `path="/hivesignerlogin"` — and remember to match `callbackURL` above.

### 3. Enable the UI option

HiveSigner is **hidden by default**. Opt in by passing `hiveSignerVisible` to `AuthButton`:

```tsx
<AuthButton
  encryptionKey={...}
  onAuthenticate={handleAuthenticate}
  aioha={aioha}
  onSignMessage={(u) => `${new Date().toISOString()}:${u}`}
  hiveSignerVisible      // ← show HiveSigner alongside Keychain / HiveAuth / Private Key
/>
```

### How the flow runs

1. User picks HiveSigner in the login dialog and enters their username.
2. Aioha redirects them to `hivesigner.com` to approve your app + requested scopes.
3. HiveSigner redirects back to your `callbackURL`, which is handled by `HiveSignerCallback`.
4. `HiveSignerCallback` normalizes the URL, completes the handshake via `@aioha/aioha`, and closes the popup / returns control to your app.
5. The package calls your `onAuthenticate` callback with the resulting `HiveAuthResult` (`provider: 'hivesigner'`), just like any other provider.

### Troubleshooting

- **Stuck on "Completing login, closing window..."** — the mounted route doesn't match `callbackURL`. Compare the path in `initAioha` against your router config.
- **"Invalid callbackURL"** from HiveSigner — register the exact URL (including `#/`) for your app at [hivesigner.com](https://hivesigner.com/).
- **Icon not showing in the modal** — make sure you're on a version that exports `HiveSignerCallback` and have passed `hiveSignerVisible`.

## Programmatic Authentication

For developers who need to authenticate users programmatically (e.g., when they already have private keys stored securely), the package provides a programmatic authentication API.

### Using the Hook (Recommended)

```tsx
import { useProgrammaticAuth } from 'hive-authentication';

function MyComponent() {
  const { 
    loginWithPrivateKey, 
    switchToUser, 
    logout, 
    logoutAll, 
    getCurrentUser, 
    getAllUsers 
  } = useProgrammaticAuth(aioha);

  const handleLogin = async () => {
    try {
      // Login with private key (no server validation)
      const user = await loginWithPrivateKey('username', '5J...');
      console.log('Logged in:', user.username);
    } catch (error) {
      console.error('Login failed:', error.message);
    }
  };

  const handleLoginWithServerValidation = async () => {
    try {
      // Login with private key + server validation
      const user = await loginWithPrivateKey('username', '5J...', async (hiveResult) => {
        const response = await fetch('/api/validate', {
          method: 'POST',
          body: JSON.stringify(hiveResult)
        });
        return response.json();
      });
      console.log('Logged in with server validation:', user.username);
    } catch (error) {
      console.error('Login failed:', error.message);
    }
  };

  return (
    <div>
      <button onClick={handleLogin}>Login Programmatically</button>
      <button onClick={handleLoginWithServerValidation}>Login with Server Validation</button>
    </div>
  );
}
```

### Using the Service Class

```tsx
import { ProgrammaticAuth } from 'hive-authentication';

const programmaticAuth = new ProgrammaticAuth(aioha);

// Login with private key
const user = await programmaticAuth.loginWithPrivateKey('username', '5J...');

// Switch to another user
await programmaticAuth.switchToUser('other-username');

// Get current user
const currentUser = programmaticAuth.getCurrentUser();

// Logout current user
await programmaticAuth.logout();

// Logout all users
await programmaticAuth.logoutAll();
```

### API Reference

#### `loginWithPrivateKey(username, privatePostingKey, serverCallback?)`

Authenticates a user with their private posting key.

- **username**: The Hive username
- **privatePostingKey**: The private posting key (starts with '5J')
- **serverCallback**: Optional callback function for server validation
- **Returns**: Promise<LoggedInUser>

#### `switchToUser(username)`

Switches to a previously logged-in user.

- **username**: The username to switch to
- **Returns**: Promise<void>

#### `logout()`

Logs out the current user.

- **Returns**: Promise<void>

#### `logoutAll()`

Logs out all users.

- **Returns**: Promise<void>

#### `getCurrentUser()`

Gets the currently logged-in user.

- **Returns**: LoggedInUser | null

#### `getAllUsers()`

Gets all logged-in users.

- **Returns**: LoggedInUser[]

## State Management

The package uses Zustand for state management. You can access the authentication state directly:

```tsx
const { currentUser, loggedInUsers, isLoading, error } = useAuthStore();
```

### State Properties

- `currentUser`: Currently logged-in user (or null)
- `loggedInUsers`: Array of all logged-in users
- `isLoading`: Whether authentication is in progress
- `error`: Any error message (or null)

### Subscribing to Changes

Use Zustand's built-in subscription to react to state changes:

```tsx
useEffect(() => {
  const unsubscribe = useAuthStore.subscribe((state) => {
    // React to any state changes
    console.log('Auth state changed:', state);
  });

  return unsubscribe;
}, []);
```

## API Reference

### Components

#### `AuthButton`
The main authentication button.

**Props:**
```tsx
interface AuthButtonProps {
  /** Required: encryption key for local storage (e.g. from your env/config). */
  encryptionKey: string;
  /** Required: called after Hive auth to run your server verification. Must return a JSON string. */
  onAuthenticate: (hiveResult: HiveAuthResult) => Promise<string>;
  /** Required: initialised Aioha instance from `@aioha/aioha`. */
  aioha: Aioha;
  /** Required: returns the message string to sign for the given username (e.g. a timestamp). */
  onSignMessage: (username: string) => string;

  /** Visual theme. Default: "light". */
  theme?: "light" | "dark";
  /** When false, the modal only shows the logged-in user with a logout button. Default: true. */
  shouldShowSwitchUser?: boolean;
  /** When true, shows an optional Active Key field in the Private Key login form. Default: false. */
  isActiveFieldVisible?: boolean;
  /** When true, shows HiveSigner as a login option. Default: false. */
  hiveSignerVisible?: boolean;
  /** Called when the login / switch-user dialog closes. */
  onClose?: () => void;

  /**
   * Optional colors for the Login button.
   * - Single color: ['#ff0000']
   * - Gradient: ['#ff0000', '#00ff00', '#0000ff']
   */
  loginButtonColors?: string[];
  /** Optional color for the "Login" text when the user is not logged in. */
  loginButtonTextColor?: string;

  /** Optional Firebase config for Web2 login (Google & Email). If omitted, Web2 button is hidden. */
  web2Config?: Web2Config;
  /** Optional callback for Web2 authentication result. Required when `web2Config` is provided. */
  onWeb2Authenticate?: (web2Result: Web2AuthResult) => Promise<string>;
}
```

**Field reference**

| Prop | Required | Default | Description |
| --- | --- | --- | --- |
| `encryptionKey` | yes | — | Symmetric key used to encrypt persisted session data in `localStorage`. Typically sourced from an env var (e.g. `VITE_APP_ENCRYPTION_KEY`). |
| `onAuthenticate` | yes | — | Server-side verification callback invoked after a successful Hive login. Receives the `HiveAuthResult` and must return a JSON string that your app can later read from `currentUser.serverResponse`. Throw to abort the login. |
| `aioha` | yes | — | Shared Aioha instance. Must be created with both `hivesigner` and `hiveauth` config (see the init snippet at the top). |
| `onSignMessage` | yes | — | Returns the plain-text message to be signed for a given username — typically an ISO timestamp. Called whenever a challenge needs to be produced (login, switch user, active-key upgrade). |
| `theme` | no | `"light"` | `"light"` or `"dark"`. |
| `shouldShowSwitchUser` | no | `true` | When `false`, the dialog only shows the active user and a logout button (no multi-account switching). |
| `isActiveFieldVisible` | no | `false` | Adds an optional Active Key input to the Private Key login form. If filled in, the key is validated and stored in `privateActiveKey`. |
| `hiveSignerVisible` | no | `false` | Reveals the HiveSigner login option. See **HiveSigner Integration** below — requires a callback route and `hivesigner.callbackURL` in the Aioha init. |
| `onClose` | no | — | Fires when either the login or switch-user modal closes. |
| `loginButtonColors` | no | — | Solid color (single entry) or gradient (multi-entry) for the Login / Add Account buttons. |
| `loginButtonTextColor` | no | — | Overrides the Login button text color. |
| `web2Config` | no | — | Firebase config enabling Google / Email login. Omit to hide the Web2 button entirely. |
| `onWeb2Authenticate` | no | — | Required iff `web2Config` is supplied. Same contract as `onAuthenticate` but receives a `Web2AuthResult`. |

**Usage:**
```tsx
<AuthButton
  encryptionKey={import.meta.env.VITE_APP_ENCRYPTION_KEY || 'your-secure-encryption-key'}
  onAuthenticate={handleAuthenticate}
  aioha={aioha}
  shouldShowSwitchUser={true}
  isActiveFieldVisible={false}
  // Opt-in: show the HiveSigner login option (requires callback route, see below)
  hiveSignerVisible={true}
  onSignMessage={(username) => `${new Date().toISOString()}:${username}`}
  // Solid color example
  // loginButtonColors={["#ef4444"]}
  // Gradient example
  // loginButtonColors={["#ec4899", "#8b5cf6"]}
  // Custom text color
  // loginButtonTextColor="#ffffff"
  // Optional Web2 login support (Google / Email)
  // web2Config={firebaseConfig}
  // onWeb2Authenticate={handleWeb2Authenticate}
/>
```

### Store

#### `useAuthStore()`
Access authentication state and actions.

**State:**
```tsx
const { currentUser, loggedInUsers, isLoading, error } = useAuthStore();
```

**Note**: The store provides read-only access to state. All modifications are handled internally by the package.

### Types

```tsx
interface HiveAuthResult {
  provider: string;           // 'keychain' | 'hiveauth' | 'hivesigner' | 'privatePostingKey'
  challenge: string;          // Hive signature
  publicKey: string;          // User's public key
  username: string;           // Hive username
  proof: string;              // Timestamp
  privatePostingKey?: string; // Present for private key login
  privateActiveKey?: string;  // Optional; present when user entered active key (private key login, only if isActiveFieldVisible was true)
}

interface LoggedInUser {
  username: string;
  provider: string;
  challenge: string;
  publicKey: string;
  proof: string;
  serverResponse: string;      // Your server response
  privatePostingKey?: string;
  privateActiveKey?: string;  // Optional active key when provided at login
}

interface Web2Config {
  apiKey: string;
  authDomain: string;
  projectId: string;
  databaseURL?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
}

interface Web2AuthResult {
  provider: "google" | "email";
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  idToken: string;
}
```

## License

MIT
