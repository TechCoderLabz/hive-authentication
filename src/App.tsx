import { useEffect, useState } from "react";
import { AuthButton } from "./components/AuthButton";
import { useAuthStore } from "./store/authStore";
import type { HiveAuthResult, LoggedInUser } from "./types/auth";
import { initAioha } from '@aioha/aioha'
import { AiohaProvider } from '@aioha/react-provider'
import { useProgrammaticAuth } from "./hooks/useProgrammaticAuth";

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
  const { loginWithPrivateKey, logout } = useProgrammaticAuth(aioha);
  const [theme, setTheme] = useState<"light" | "dark">("light"); // Add theme state
  const user = "user-name-goes-here";
  const key = "your-private-posting-key";

  useEffect(() => {
    let previousUser = currentUser;
    // Subscribe to store changes
    const unsubscribe = useAuthStore.subscribe((state) => {
      const currentUser = state.currentUser;
      // Detect login/logout/user switch
      if (currentUser && !previousUser) {
        // console.log("User logged in:", currentUser);
      } else if (!currentUser && previousUser) {
        // console.log("User logged out:", previousUser);
      } else if (
        currentUser &&
        previousUser &&
        currentUser.username !== previousUser.username
      ) {
        // console.log("User switched to:", currentUser);
      }
      previousUser = currentUser;
    });
    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    // Apply the theme manually by setting a data-theme attribute on the HTML element
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const handleAuthenticate = async (
    hiveResult: HiveAuthResult
  ): Promise<string> => {
    // console.log("Hive authentication result:", hiveResult);

    try {
      const response = await fetch("https://beta-api.distriator.com/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challenge: hiveResult.challenge,
          username: hiveResult.username,
          pubkey: hiveResult.publicKey,
          proof: hiveResult.proof,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server authentication failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      // console.log('Server response:', data);

      // Return your server response as JSON string
      return JSON.stringify(data);
    } catch (error) {
      console.error("Authentication error:", error);
      throw error;
    }
  };

  const handleProgrammaticLogin = async () => {
    const userInfo = await loginWithPrivateKey(user, key, async (hiveResult) => {
        console.log("Hive result:", hiveResult);
        // TODO: Add server validation
        return JSON.stringify({ message: "Server validation successful" });
    });
    console.log("User logged in:", userInfo);
  };

  const handleProgrammaticLogout = async () => {
    try {
      await logout();
      // console.log("User logged out");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <AiohaProvider aioha={aioha}>
      <div
        className={`min-h-screen ${
          theme === "dark" ? "bg-gray-800 text-white" : "bg-base-200 text-black"
        } p-8`}
      >
        <div className="max-w-4xl mx-auto">
          {/* Theme Toggle */}
          <div className="flex justify-end mb-4">
            <button
              className="btn btn-outline"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              Switch to {theme === "light" ? "Dark" : "Light"} Mode
            </button>
          </div>

          {/* Auth Section */}
          <div
            className={`card ${
              theme === "dark" ? "bg-gray-900" : "bg-base-100"
            } shadow-xl mb-8`}
          >
            <div className="card-body">
              <h2 className="card-title text-2xl">Hive Authentication Demo</h2>
              <p className="text-base-content/70">
                This is a demo of the Hive Authentication package with a working API integration.
              </p>
              <div className="card-actions justify-center mt-4">
                <AuthButton
                  onAuthenticate={handleAuthenticate}
                  aioha={aioha}
                  onClose={() => {
                    // console.log("AuthButton dialog closed");
                  }}
                  isActiveFieldVisible={true}
                  onSignMessage={(username) => {
                    return `${new Date().toISOString()}:${username}`;
                  }}
                  theme={theme} // Pass theme to AuthButton
                />
              </div>
              <div className="card-actions justify-center mt-4">
                <button onClick={handleProgrammaticLogin} className="btn btn-primary">Programmatic Login</button>
              </div>
              <div className="card-actions justify-center mt-4">
                <button onClick={handleProgrammaticLogout} className="btn btn-secondary">Programmatic Logout</button>
              </div>
            </div>
          </div>
          {/* Current User Info */}
          {currentUser && (
            <div className="card bg-green-50 border border-green-200 mb-6">
              <div className="card-body">
                <h3 className="card-title text-green-800">Currently Logged In</h3>
                <div className="space-y-2 text-green-700">
                  <p>
                    <strong>Username:</strong> {currentUser.username}
                  </p>
                  <p>
                    <strong>Provider:</strong> {currentUser.provider}
                  </p>
                  <p>
                    <strong>Public Key:</strong> {currentUser.publicKey.substring(0, 20)}...
                  </p>
                  <p>
                    <strong>Server Response:</strong> {currentUser.serverResponse.substring(0, 20)}...
                  </p>
                </div>
              </div>
            </div>
          )}
          {/* Logged In Users */}
          {loggedInUsers.length > 0 && (
            <div className="card bg-blue-50 border border-blue-200 mb-6">
              <div className="card-body">
                <h3 className="card-title text-blue-800">
                  All Logged In Users ({loggedInUsers.length})
                </h3>
                <div className="space-y-2">
                  {loggedInUsers.map((user: LoggedInUser) => (
                    <div key={user.username} className="text-blue-700 flex items-center gap-2">
                      <span>•</span>
                      <span>{user.username}</span>
                      <span className="text-blue-500">({user.provider})</span>
                      {currentUser?.username === user.username && (
                        <span className="badge badge-primary badge-sm">Current</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </AiohaProvider>
  );
}
export default App;