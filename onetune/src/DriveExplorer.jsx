import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { useGraphClient } from "./useGraphClient";

export function DriveExplorer() {
  const { accounts } = useMsal();
  const graphClient = useGraphClient();
  const [files, setFiles] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Solo intentar cargar si tenemos una cuenta
    if (!accounts || accounts.length === 0) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    
    async function fetchFiles() {
      try {
        const res = await graphClient("/me/drive/root/children");
        
        // Evitar actualizar estado si el componente se desmontó
        if (!isMounted) return;
        
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Error: ${errorText}`);
        }
        
        const data = await res.json();
        setFiles(data.value);
        setLoading(false);
      } catch (e) {
        console.error("Error:", e);
        if (isMounted) {
          setError(e.message);
          setLoading(false);
        }
      }
    }

    fetchFiles();
    
    // Limpieza para evitar actualizaciones en componentes desmontados
    return () => {
      isMounted = false;
    };
  }, [graphClient, accounts]);

  if (!accounts || accounts.length === 0) return <div>No hay cuenta disponible</div>;
  if (loading) return <div>Cargando archivos...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!files) return <div>No se encontraron archivos</div>;

  return (
    <ul>
      {files.map(file => (
        <li key={file.id}>
          {file.name} {file.folder ? '(Carpeta)' : `(${file.size} bytes)`}
        </li>
      ))}
    </ul>
  );
}