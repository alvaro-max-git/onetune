import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./authConfig";

// Inicializar la aplicación con las opciones
const msalInstance = new PublicClientApplication(msalConfig);

// Es importante esperar a que MSAL se inicialice
msalInstance.initialize().then(() => {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </React.StrictMode>
  );
});