import { useIsAuthenticated } from "@azure/msal-react";
import { SignInButton, SignOutButton } from "./AuthComponents";
import './App.css';
import { DriveExplorer } from "./DriveExplorer";

function App() {
  
  //Comprueba si el usuario está autenticado
  const isAuth = useIsAuthenticated();

  return (
    <div>
      <header>
        {isAuth ? <SignOutButton /> : null}
      </header>
      <main>
        {isAuth ? <DriveExplorer /> : <SignInButton />}
      </main>
    </div>
  );
}

export default App;
