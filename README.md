# Hive Authentication

A React package for Hive blockchain authentication with a simple callback-based API and Zustand state management.

## Installation

```bash
npm install hive-authentication
```

## Quick Start

### 1. Environment Variables

```bash
# Required: Encryption key for local storage
VITE_LOCAL_KEY=your-secure-encryption-key
```

### 2. Import CSS

```tsx
import 'hive-authentication/build.css';
```

### 3. Use the Auth Button with Callback

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

  // Your authentication callback - works for both login AND adding accounts
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

  return (
    <AiohaProvider aioha={aioha}>
      <div>
        <h1>My App</h1>
          <AuthButton 
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
  onAuthenticate: (hiveResult: HiveAuthResult) => Promise<string>;
  aioha: Aioha;
  shouldShowSwitchUser?: boolean;   // default: true
  isActiveFieldVisible?: boolean;   // default: false — when true, shows optional Active Key field in private key login
  onClose?: () => void;
  onSignMessage: (username: string) => string;
}
```

**Usage:**
```tsx
<AuthButton 
  onAuthenticate={handleAuthenticate}
  aioha={aioha}
  shouldShowSwitchUser={true}
  isActiveFieldVisible={false}
  onSignMessage={(username) => `${new Date().toISOString()}:${username}`}
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
  provider: string;           // 'keychain' | 'hiveauth' | 'privatePostingKey'
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
```

## License

MIT
