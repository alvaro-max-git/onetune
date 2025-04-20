import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGraphClient } from './useGraphClient'; // Necesitamos el cliente para obtener la URL

export function AudioPlayer({ playlistPaths }) {
  const graphClient = useGraphClient();
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTrackUrl, setCurrentTrackUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null); // Ref para el elemento <audio>

  // Función para obtener la URL de descarga temporal de Graph
  const fetchTrackUrl = useCallback(async (trackPath) => {
    if (!trackPath) return;
    setIsLoadingUrl(true);
    setError(null);
    // setCurrentTrackUrl(null); // <-- NO LIMPIAR LA URL AQUÍ

    try {
      const drivePrefix = "/drive/root:";
      let itemPath = '';

      if (trackPath.startsWith(drivePrefix)) {
        itemPath = trackPath.substring(drivePrefix.length);
      } else {
        throw new Error(`La ruta de la pista no tiene el formato esperado: ${trackPath}`);
      }

      const relativePath = itemPath.startsWith('/') ? itemPath.substring(1) : itemPath;
      const encodedRelativePath = relativePath.split('/').map(encodeURIComponent).join('/');
      const endpoint = `/me/drive/root:/${encodedRelativePath}`;

      console.log("Fetching URL for endpoint:", endpoint);

      const res = await graphClient(endpoint);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Graph API Error Response:", errorText);
        throw new Error(`Error fetching download URL: ${errorText}`);
      }
      const data = await res.json();
      console.log("Graph API Response Data:", data);

      const downloadUrl = data['@microsoft.graph.downloadUrl'];

      if (!downloadUrl) {
        console.error("Download URL not found. Available keys:", Object.keys(data));
        throw new Error("No se encontró la URL de descarga en la respuesta.");
      }

      // Establecer la nueva URL. El useEffect se encargará de actualizar el <audio>
      setCurrentTrackUrl(downloadUrl);

    } catch (e) {
      console.error("Error fetching track URL:", e);
      setError(e.message);
      // Considera si quieres detener la reproducción o intentar la siguiente pista aquí
    } finally {
      setIsLoadingUrl(false);
    }
  }, [graphClient]);

// Efecto para cargar la URL cuando cambia el índice de la pista
   useEffect(() => {
    if (playlistPaths && playlistPaths.length > 0) {
      // fetchTrackUrl obtiene la nueva URL y la establece en el estado
      fetchTrackUrl(playlistPaths[currentTrackIndex]);
    }
  }, [currentTrackIndex, playlistPaths, fetchTrackUrl]);


// Efecto para controlar la reproducción y actualizar el src del <audio>
  useEffect(() => {
    const audioElement = audioRef.current;
    if (audioElement && currentTrackUrl) {
      // Si la URL del elemento <audio> es diferente a la URL actual en estado,
      // actualízala y llama a load() para que el navegador la cargue.
      if (audioElement.src !== currentTrackUrl) {
        console.log("Setting new audio src:", currentTrackUrl);
        audioElement.src = currentTrackUrl;
        audioElement.load(); // Importante: indica al navegador que cargue la nueva fuente
      }

      // Ahora maneja play/pause basado en isPlaying
      if (isPlaying) {
        // Intentar reproducir. Es importante hacerlo después de load() o setting src.
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Error attempting to play:", error);
            // El navegador puede bloquear el autoplay si no hubo interacción del usuario
            // o si la carga aún no está lista.
            setIsPlaying(false); // Resetear estado si falla el play
          });
        }
      } else {
        // Si no está 'isPlaying', pausar.
        audioElement.pause();
      }
    } else if (audioElement) {
       // Si no hay URL válida pero sí elemento audio, pausar.
       audioElement.pause();
       // Opcional: podrías limpiar el src aquí si prefieres, pero pausar es suficiente
       // audioElement.src = '';
    }
  }, [isPlaying, currentTrackUrl]); // Depende de ambos estados

  const handlePlayPause = () => {
    if (!currentTrackUrl) return; // No hacer nada si no hay URL
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    const nextIndex = (currentTrackIndex + 1) % playlistPaths.length;
    setCurrentTrackIndex(nextIndex);
    setIsPlaying(true); // Auto-play next track
  };

  const handlePrevious = () => {
    const prevIndex = (currentTrackIndex - 1 + playlistPaths.length) % playlistPaths.length;
    setCurrentTrackIndex(prevIndex);
    setIsPlaying(true); // Auto-play previous track
  };

  // Manejar el final de la pista para pasar a la siguiente
  const handleEnded = () => {
    handleNext();
  };

  const currentTrackName = playlistPaths && playlistPaths.length > 0
    ? playlistPaths[currentTrackIndex].split('/').pop() // Obtener nombre del archivo de la ruta
    : "N/A";

  return (
    <div style={{ border: '1px solid #ccc', padding: '15px', marginTop: '20px', borderRadius: '5px' }}>
      <h4>Reproductor</h4>
      {isLoadingUrl && <p>Cargando URL de la pista...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      <p>Pista actual: {currentTrackName || 'Ninguna'}</p>

      <audio
        ref={audioRef}
        src={currentTrackUrl || ''}
        onEnded={handleEnded}
        onError={(e) => setError(`Error del elemento audio: ${e.target.error?.message || 'desconocido'}`)}
        // controls // Puedes descomentar esto para ver los controles nativos
      />

      <div style={{ marginTop: '10px' }}>
        <button onClick={handlePrevious} disabled={!playlistPaths || playlistPaths.length === 0 || isLoadingUrl}>
          Anterior
        </button>
        <button onClick={handlePlayPause} disabled={!currentTrackUrl || isLoadingUrl} style={{ margin: '0 10px' }}>
          {isPlaying ? 'Pausa' : 'Play'}
        </button>
        <button onClick={handleNext} disabled={!playlistPaths || playlistPaths.length === 0 || isLoadingUrl}>
          Siguiente
        </button>
      </div>
    </div>
  );
}