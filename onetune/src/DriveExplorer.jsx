import { useEffect, useState, useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { useGraphClient } from "./useGraphClient";
import { AudioPlayer } from './AudioPlayer';
// Importaríamos las funciones de parseo si estuvieran en otro archivo
// import { parseM3u } from './m3uParser';

// --- Helper para resolver rutas (Idealmente en m3uParser.js) ---
function resolveRelativePath(relativePath, basePath) {
  // basePath es como '/drive/root:/path/to/folder'
  // relativePath es como '../../Artist/Album/Song.mp3'

  // Quitar /drive/root: temporalmente para facilitar la lógica
  const drivePrefix = "/drive/root:";
  if (!basePath.startsWith(drivePrefix)) {
    console.error("Base path no tiene el formato esperado:", basePath);
    return null; // O manejar el error como prefieras
  }
  const pathWithoutPrefix = basePath.substring(drivePrefix.length);

  const baseSegments = pathWithoutPrefix.split('/').filter(Boolean); // ['path', 'to', 'folder']
  const relativeSegments = relativePath.split('/').filter(Boolean); // ['..', '..', 'Artist', 'Album', 'Song.mp3']

  let currentSegments = [...baseSegments];

  for (const segment of relativeSegments) {
    if (segment === '..') {
      if (currentSegments.length > 0) {
        currentSegments.pop(); // Subir un nivel
      } else {
        console.error("Intento de subir más allá de la raíz:", relativePath, basePath);
        return null; // Ruta inválida
      }
    } else if (segment !== '.') {
      currentSegments.push(segment); // Bajar o añadir nombre de archivo
    }
  }

  // Volver a añadir el prefijo y unir
  return drivePrefix + currentSegments.join('/');
}

// --- Componente DriveExplorer ---
export function DriveExplorer() {
  const { accounts } = useMsal();
  const graphClient = useGraphClient();
  const [currentItemId, setCurrentItemId] = useState("root");
  const [parentItemId, setParentItemId] = useState(null);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playlistPaths, setPlaylistPaths] = useState(null); // Estado para las rutas de la playlist
  const [currentView, setCurrentView] = useState('explorer'); // 'explorer' o 'playlist'

  const fetchItems = useCallback(async (itemId) => {
    // ... (código fetchItems existente sin cambios) ...
    setLoading(true);
    setError(null);
    setItems(null);
    setPlaylistPaths(null); // Limpiar playlist al navegar
    setCurrentView('explorer'); // Asegurar vista de explorador

    try {
      const endpoint = `/me/drive/items/${itemId}/children?$select=id,name,folder,file,size,parentReference`;
      const res = await graphClient(endpoint);
      if (!res.ok) { /* ... manejo de error ... */ throw new Error(`Error fetching items: ${await res.text()}`); }
      const data = await res.json();
      const filteredItems = data.value.filter(item =>
        item.folder || (item.file && item.name.toLowerCase().endsWith('.m3u'))
      );
      setItems(filteredItems);

      // Obtener ID del padre
      if (itemId !== 'root') {
        const parentRes = await graphClient(`/me/drive/items/${itemId}?$select=parentReference`);
        if (parentRes.ok) {
          const parentData = await parentRes.json();
          setParentItemId(parentData.parentReference?.id);
        } else {
          setParentItemId(null);
        }
      } else {
        setParentItemId(null);
      }
    } catch (e) { /* ... manejo de error ... */ console.error("Error:", e); setError(e.message); }
    finally { setLoading(false); }
  }, [graphClient]);

  useEffect(() => {
    if (accounts && accounts.length > 0) {
      fetchItems(currentItemId);
    } else {
      setLoading(false);
    }
  }, [currentItemId, accounts, fetchItems]);

  // --- Nueva función para cargar y parsear M3U ---
  const loadAndParseM3u = useCallback(async (m3uItem) => {
    setLoading(true);
    setError(null);
    setPlaylistPaths(null);

    try {
      // 1. Obtener contenido del M3U
      const contentRes = await graphClient(`/me/drive/items/${m3uItem.id}/content`);
      if (!contentRes.ok) throw new Error(`Error fetching M3U content: ${await contentRes.text()}`);
      const m3uContent = await contentRes.text();

      // 2. Obtener ruta del padre del M3U
      const itemDetailsRes = await graphClient(`/me/drive/items/${m3uItem.id}?$select=parentReference`);
      if (!itemDetailsRes.ok) throw new Error(`Error fetching M3U details: ${await itemDetailsRes.text()}`);
      const itemDetails = await itemDetailsRes.json();
      const parentPath = itemDetails.parentReference?.path; // e.g., '/drive/root:/Music/Playlists'

      if (!parentPath) throw new Error("No se pudo obtener la ruta del padre del M3U.");

      // 3. Parsear contenido y resolver rutas
      const lines = m3uContent.split('\n');
      const resolvedPaths = lines
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')) // Ignorar vacías y comentarios
        .map(relativePath => resolveRelativePath(relativePath, parentPath)) // Resolver cada ruta
        .filter(Boolean); // Filtrar resultados nulos de la resolución

      setPlaylistPaths(resolvedPaths);
      setCurrentView('playlist'); // Cambiar a la vista de playlist
      setItems(null); // Ocultar la lista de archivos/carpetas

    } catch (e) {
      console.error("Error loading/parsing M3U:", e);
      setError(e.message);
      setCurrentView('explorer'); // Volver al explorador en caso de error
    } finally {
      setLoading(false);
    }
  }, [graphClient]);

  const handleItemClick = (item) => {
    if (item.folder) {
      setCurrentItemId(item.id); // Navegar a carpeta
    } else if (item.file && item.name.toLowerCase().endsWith('.m3u')) {
      loadAndParseM3u(item); // Cargar y parsear archivo M3U
    }
    // Clic en otros archivos (si los hubiera) no hace nada por ahora
  };

  const handleBackClick = () => {
    if (currentView === 'playlist') {
      // Si estamos viendo una playlist, "Atrás" vuelve al explorador
      setPlaylistPaths(null);
      setCurrentView('explorer');
      // Volver a cargar los items de la carpeta actual (donde estaba el m3u)
      // No cambiamos currentItemId, así que el useEffect lo recargará si es necesario,
      // pero forzamos la recarga para asegurar que se muestre la lista.
      fetchItems(currentItemId);
    } else if (parentItemId) {
      // Si estamos en el explorador, "Atrás" sube de carpeta
      setCurrentItemId(parentItemId);
    }
  };

  // --- Renderizado ---
  if (!accounts || accounts.length === 0) return <div>No hay cuenta disponible</div>;
  if (loading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {/* Botón Atrás: funciona para subir carpeta o salir de la vista playlist */}
      {(parentItemId || currentView === 'playlist') && (
         <button onClick={handleBackClick} style={{ marginBottom: '10px' }}>
           &larr; Atrás
         </button>
      )}

      {/* Mostrar explorador o playlist */}
      {currentView === 'explorer' && items && (
        <ul>
          {items.map(item => (
            <li
              key={item.id}
              onClick={() => handleItemClick(item)}
              style={{ cursor: 'pointer', listStyleType: 'none', padding: '5px 0' }}
            >
              {item.folder ? '📁' : (item.name.toLowerCase().endsWith('.m3u') ? '🎵' : '📄')} {item.name}
            </li>
          ))}
          {items.length === 0 && <li>Carpeta vacía</li>}
        </ul>
      )}

      {currentView === 'playlist' && playlistPaths && (
        <div>
          <h3>Playlist Cargada:</h3>
          {/* Renderiza el reproductor aquí */}
          <AudioPlayer playlistPaths={playlistPaths} />

          {/* Opcional: Mostrar la lista de rutas debajo del reproductor */}
          {/*
          <ul>
            {playlistPaths.map((path, index) => (
              <li key={index} style={{ listStyleType: 'none', padding: '2px 0', fontFamily: 'monospace', fontSize: '0.9em' }}>
                {path}
              </li>
            ))}
            {playlistPaths.length === 0 && <li>Playlist vacía o sin rutas válidas.</li>}
          </ul>
          */}
        </div>
      )}
      {currentView === 'playlist' && error && <div style={{ color: 'red' }}>Error cargando playlist: {error}</div>}


      {/* Mensaje si no hay items y no es una playlist */}
      {currentView === 'explorer' && !items && !loading && <div>No se encontraron elementos.</div>}

    </div>
  );
}