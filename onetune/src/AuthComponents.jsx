import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { loginRequest } from "./authConfig";

export function SignInButton() {
  const { instance } = useMsal();
  return (
    <button
      onClick={() => instance.loginPopup(loginRequest)}
      className="px-4 py-2 rounded-xl bg-blue-600 text-white"
    >
      Sign in
    </button>
  );
}

export function SignOutButton() {
  const { instance } = useMsal();
  return (
    <button onClick={() => instance.logoutPopup()}>
      Sign out
    </button>
  );
}