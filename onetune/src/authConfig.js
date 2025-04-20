export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
    //authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    authority: "https://login.microsoftonline.com/common",
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: true,  // Cambia a true para mejor compatibilidad
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message) => {
        console.log(message);
      },
      logLevel: "Verbose",
    }
  }
};

export const loginRequest = {
  scopes: ["Files.Read", "User.Read"],
};
