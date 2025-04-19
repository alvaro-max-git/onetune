import { useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { loginRequest } from "./authConfig";

export function useGraphClient() {
  const { instance, accounts } = useMsal();

  return useCallback(async (endpoint, init = {}) => {
    if (!accounts || accounts.length === 0) {
      throw new Error("No hay cuentas disponibles");
    }

    let accessToken;
    try {
      // Intenta obtener token silenciosamente
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0]
      });
      accessToken = response.accessToken;
    } catch (error) {
      // Si requiere interacción, solicitamos con popup
      if (error instanceof InteractionRequiredAuthError) {
        const response = await instance.acquireTokenPopup(loginRequest);
        accessToken = response.accessToken;
      } else {
        throw error;
      }
    }

    // Hacer la petición con el token
    return fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${accessToken}`
      }
    });
  }, [instance, accounts]);
}