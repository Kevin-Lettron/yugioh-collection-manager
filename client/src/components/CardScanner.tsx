import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { scanCard, ScanResult, debugLog } from '../services/api';

interface CardScannerProps {
  onScanComplete: (result: ScanResult, userPhotoUrl: string) => void;
  onClose: () => void;
}

type View = 'initial' | 'inpage-camera' | 'preview';

const MAX_WIDTH = 1024;
const JPEG_QUALITY = 0.88;

const compressBlob = (blob: Blob): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, MAX_WIDTH / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas 2D non supporté'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Compression impossible'))),
          'image/jpeg',
          JPEG_QUALITY
        );
      };
      img.onerror = () => reject(new Error('Image illisible'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Lecture blob impossible'));
    reader.readAsDataURL(blob);
  });

const captureVideoFrame = (video: HTMLVideoElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const ratio = Math.min(1, MAX_WIDTH / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * ratio);
    canvas.height = Math.round(video.videoHeight * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Canvas non supporté'));
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Capture vidéo échouée'))),
      'image/jpeg',
      JPEG_QUALITY
    );
  });

const compressFile = (file: File): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, MAX_WIDTH / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas 2D non supporté'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Compression impossible'))),
          'image/jpeg',
          JPEG_QUALITY
        );
      };
      img.onerror = () => reject(new Error('Image illisible'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Lecture fichier impossible'));
    reader.readAsDataURL(file);
  });

const CardScanner = ({ onScanComplete, onClose }: CardScannerProps) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [view, setView] = useState<View>('initial');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [description, setDescription] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [focusIndicator, setFocusIndicator] = useState<{ x: number; y: number; key: number } | null>(null);
  const [capabilities, setCapabilities] = useState<any>(null);
  const [showCaps, setShowCaps] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Manual controls (shown when hardware exposes them)
  const [focusValue, setFocusValue] = useState<number | null>(null);
  const [zoomValue, setZoomValue] = useState<number>(1);
  const [torchOn, setTorchOn] = useState(false);

  // Device picker (for tels with multiple rear cameras)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  useEffect(() => {
    debugLog('scanner:mount');
    return () => {
      debugLog('scanner:unmount');
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view === 'inpage-camera' && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [view, stream]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  };

  const startInPageCamera = async (deviceId?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Caméra intégrée non supportée par ce navigateur.');
      return;
    }
    debugLog('scanner:inpage_camera_start', { deviceId: deviceId || 'default' });
    setCameraStarting(true);

    // Fully release any existing stream (switching cameras or retry)
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
      // Small delay so the OS releases the device before we ask again
      await new Promise((r) => setTimeout(r, 150));
    }

    // Build a ladder of constraints — try from best quality to minimal.
    const baseConstraints = deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: { ideal: 'environment' } };

    const candidates: MediaTrackConstraints[] = [
      { ...baseConstraints, width: { ideal: 3840 }, height: { ideal: 2160 } },
      { ...baseConstraints, width: { ideal: 1920 }, height: { ideal: 1080 } },
      { ...baseConstraints, width: { ideal: 1280 }, height: { ideal: 720 } },
      baseConstraints,
      { facingMode: { ideal: 'environment' } }, // last resort: ignore deviceId
      {}, // absolute fallback
    ];

    let s: MediaStream | null = null;
    let lastError: any = null;
    for (const [i, c] of candidates.entries()) {
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: c, audio: false });
        debugLog('scanner:getUserMedia_ok', { candidate: i, constraint: c });
        break;
      } catch (e: any) {
        lastError = e;
        debugLog('scanner:getUserMedia_retry', {
          candidate: i,
          errorName: e?.name,
          errorMessage: e?.message,
        });
      }
    }

    if (!s) {
      const err = lastError || new Error('Unknown camera error');
      debugLog('scanner:getUserMedia_error', { name: err.name, message: err.message });
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        toast.error("Autorise l'accès caméra dans les paramètres du navigateur.");
      } else if (err.name === 'NotFoundError') {
        toast.error('Aucune caméra détectée.');
      } else if (err.name === 'NotReadableError') {
        toast.error('Caméra utilisée par une autre app. Ferme-la et réessaie.');
      } else {
        toast.error(`Erreur caméra : ${err.name || 'inconnue'} — ${err.message || ''}`);
      }
      setCameraStarting(false);
      return;
    }

    try {

      // Enumerate devices now that we have camera permission (labels are empty without it)
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videos = devices.filter((d) => d.kind === 'videoinput');
        setVideoDevices(videos);
        const currentTrack = s.getVideoTracks()[0];
        const currentDeviceId = currentTrack.getSettings().deviceId;
        if (currentDeviceId) setSelectedDeviceId(currentDeviceId);
        debugLog('scanner:enumerate_devices', {
          count: videos.length,
          devices: videos.map((d) => ({ id: d.deviceId.slice(0, 8), label: d.label })),
          currentDeviceId: currentDeviceId?.slice(0, 8),
        });
      } catch (e) {
        debugLog('scanner:enumerate_failed', { error: String(e) });
      }

      const track = s.getVideoTracks()[0];
      const caps: any = track.getCapabilities?.() || {};
      setCapabilities(caps);
      debugLog('scanner:track_capabilities', {
        hasFocusMode: !!caps.focusMode,
        focusModes: caps.focusMode,
        hasFocusDistance: !!caps.focusDistance,
        focusDistance: caps.focusDistance,
        hasPointsOfInterest: !!caps.pointsOfInterest,
        hasZoom: !!caps.zoom,
        zoom: caps.zoom,
        hasTorch: !!caps.torch,
        videoWidth: caps.width,
        videoHeight: caps.height,
      });

      // Try continuous autofocus if supported
      if (caps.focusMode?.includes('continuous')) {
        try {
          await track.applyConstraints({
            advanced: [{ focusMode: 'continuous' } as any],
          });
          debugLog('scanner:applied_continuous_focus');
        } catch (e) {
          debugLog('scanner:continuous_focus_failed', { error: String(e) });
        }
      } else if (caps.focusMode?.includes('manual') && caps.focusDistance) {
        // Manual-only driver: initialize a sensible focus distance (close-up)
        // focusDistance usually ranges from small (near) to large (far).
        // Card at ~20-25cm → bias toward the near side of the range.
        const initial =
          caps.focusDistance.min + (caps.focusDistance.max - caps.focusDistance.min) * 0.25;
        try {
          await track.applyConstraints({
            advanced: [{ focusMode: 'manual', focusDistance: initial } as any],
          });
          setFocusValue(initial);
          debugLog('scanner:applied_manual_focus', { distance: initial });
        } catch (e) {
          debugLog('scanner:manual_focus_init_failed', { error: String(e) });
        }
      }

      // Initialize zoom state from current settings
      if (caps.zoom) {
        const settings: any = track.getSettings?.() || {};
        setZoomValue(settings.zoom || caps.zoom.min || 1);
      }

      setStream(s);
      setView('inpage-camera');
    } catch (err: any) {
      debugLog('scanner:post_getUserMedia_error', { name: err.name, message: err.message });
      toast.error(`Erreur après démarrage caméra : ${err.message || err.name}`);
    } finally {
      setCameraStarting(false);
    }
  };

  const tapToFocus = async (event: React.MouseEvent<HTMLVideoElement> | React.TouchEvent<HTMLVideoElement>) => {
    if (!stream) return;
    const video = event.currentTarget;
    const rect = video.getBoundingClientRect();

    let clientX: number, clientY: number;
    if ('touches' in event) {
      if (event.touches.length === 0) return;
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    const xRatio = (clientX - rect.left) / rect.width;
    const yRatio = (clientY - rect.top) / rect.height;

    // 1. Show visual feedback immediately
    setFocusIndicator({ x: clientX - rect.left, y: clientY - rect.top, key: Date.now() });
    setTimeout(() => setFocusIndicator(null), 1200);

    // 2. Try progressive focus approaches
    const track = stream.getVideoTracks()[0];
    const caps: any = track.getCapabilities?.() || {};

    let applied = false;

    // Approach A: pointsOfInterest + single-shot (best — actual tap-to-focus)
    if (caps.pointsOfInterest && caps.focusMode?.includes('single-shot')) {
      try {
        await track.applyConstraints({
          advanced: [
            {
              pointsOfInterest: [{ x: xRatio, y: yRatio }],
              focusMode: 'single-shot',
            } as any,
          ],
        });
        debugLog('scanner:focus_points_of_interest', { xRatio, yRatio });
        applied = true;
      } catch (e) {
        debugLog('scanner:poi_failed', { error: String(e) });
      }
    }

    // Approach B: just trigger a single-shot (forces driver to refocus even without POI)
    if (!applied && caps.focusMode?.includes('single-shot')) {
      try {
        await track.applyConstraints({
          advanced: [{ focusMode: 'single-shot' } as any],
        });
        debugLog('scanner:focus_single_shot');
        applied = true;
      } catch (e) {
        debugLog('scanner:single_shot_failed', { error: String(e) });
      }
    }

    // Approach C: toggle continuous → continuous (some drivers restart AF on re-apply)
    if (!applied && caps.focusMode?.includes('continuous')) {
      try {
        await track.applyConstraints({ advanced: [{ focusMode: 'manual' } as any] });
        await new Promise((r) => setTimeout(r, 50));
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
        debugLog('scanner:focus_continuous_retoggle');
        applied = true;
      } catch (e) {
        debugLog('scanner:continuous_toggle_failed', { error: String(e) });
      }
    }

    if (!applied) {
      debugLog('scanner:no_focus_capability');
    }
  };

  const applyFocus = async (distance: number) => {
    if (!stream || !capabilities?.focusDistance) return;
    const track = stream.getVideoTracks()[0];
    try {
      await track.applyConstraints({
        advanced: [{ focusMode: 'manual', focusDistance: distance } as any],
      });
      setFocusValue(distance);
      // Read back what the driver actually accepted (sometimes it silently clamps/ignores)
      const settings: any = track.getSettings?.() || {};
      debugLog('scanner:apply_focus', {
        requested: distance,
        accepted: settings.focusDistance,
        focusMode: settings.focusMode,
      });
    } catch (e) {
      debugLog('scanner:apply_focus_failed', { error: String(e) });
    }
  };

  const applyZoom = async (zoom: number) => {
    if (!stream || !capabilities?.zoom) return;
    const track = stream.getVideoTracks()[0];
    try {
      await track.applyConstraints({ advanced: [{ zoom } as any] });
      setZoomValue(zoom);
    } catch (e) {
      debugLog('scanner:apply_zoom_failed', { error: String(e) });
    }
  };

  const toggleTorch = async () => {
    if (!stream || !capabilities?.torch) return;
    const track = stream.getVideoTracks()[0];
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as any] });
      setTorchOn(next);
    } catch (e) {
      debugLog('scanner:toggle_torch_failed', { error: String(e) });
    }
  };

  const capturePhoto = async () => {
    if (!stream) return;
    debugLog('scanner:capture_start');
    setCapturing(true);
    try {
      const track = stream.getVideoTracks()[0];
      let blob: Blob | null = null;

      // Prefer ImageCapture.takePhoto — triggers AF cycle + full-resolution
      const ImageCaptureCtor = (window as any).ImageCapture;
      if (ImageCaptureCtor) {
        try {
          const imageCapture = new ImageCaptureCtor(track);
          const rawPhoto: Blob = await imageCapture.takePhoto();
          debugLog('scanner:takePhoto_ok', { size: rawPhoto.size });
          blob = await compressBlob(rawPhoto);
        } catch (e) {
          debugLog('scanner:takePhoto_failed', { error: String(e) });
        }
      } else {
        debugLog('scanner:no_ImageCapture_api');
      }

      if (!blob) {
        // Fallback: capture current video frame (lower res, no AF trigger)
        const video = videoRef.current;
        if (!video || !video.videoWidth) {
          toast.error('Caméra non prête, réessaie');
          return;
        }
        blob = await captureVideoFrame(video);
        debugLog('scanner:capture_fallback_frame', { size: blob.size });
      }

      const url = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
      setCompressedBlob(blob);
      stopCamera();
      setView('preview');
    } catch (err: any) {
      debugLog('scanner:capture_error', { message: err?.message });
      toast.error('Capture échouée');
    } finally {
      setCapturing(false);
    }
  };

  const handleFile = async (file: File | undefined, source: 'camera' | 'gallery') => {
    debugLog('scanner:onchange', {
      source,
      hasFile: !!file,
      type: file?.type,
      sizeBytes: file?.size,
    });
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }
    try {
      const compressed = await compressFile(file);
      const url = URL.createObjectURL(compressed);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
      setCompressedBlob(compressed);
      setView('preview');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la compression');
    }
  };

  const handleScan = async () => {
    if (!compressedBlob || !previewUrl) {
      toast.error("Ajoutez d'abord une photo");
      return;
    }
    setScanning(true);
    try {
      const result = await scanCard(compressedBlob, description);
      if (!result.success) {
        // Le serveur refuse de valider quand les signaux lus contredisent la carte
        // trouvée, mais il peut quand même proposer des pistes : dans ce cas on
        // ouvre la confirmation pour laisser l'utilisateur trancher.
        if (!result.card && !result.alternatives?.length) {
          toast.error(result.error || 'Scan échoué');
          setScanning(false);
          return;
        }
        toast.error(result.error || 'Identification incertaine — vérifie la carte');
      }
      onScanComplete(result, previewUrl);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur lors du scan');
    } finally {
      setScanning(false);
    }
  };

  const resetToInitial = () => {
    stopCamera();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCompressedBlob(null);
    setDescription('');
    setView('initial');
  };

  const handleClose = () => {
    stopCamera();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-bold text-gray-800">Scanner une carte</h3>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label="Fermer"
          >
            &times;
          </button>
        </div>

        <div className="p-4 space-y-4">
          {view === 'initial' && (
            <>
              <p className="text-gray-600 text-sm">
                Prends en photo le code en bas de la carte (format <code>XXX-XXNNN</code>).
                La caméra intégrée reste dans la PWA — robuste, mais touche le code à l'écran pour faire la mise au point.
              </p>

              <button
                onClick={() => {
                  const preferred = localStorage.getItem('preferredCameraId');
                  startInPageCamera(preferred || undefined);
                }}
                disabled={cameraStarting}
                className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-4 px-4 rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-blue-400"
              >
                {cameraStarting ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-4 border-white border-t-transparent" />
                ) : (
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
                <span>Caméra intégrée (recommandé)</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    debugLog('scanner:camera_click');
                    try {
                      localStorage.setItem(
                        'pendingScan',
                        JSON.stringify({ at: Date.now(), cameraClicked: true })
                      );
                    } catch {
                      /* ignore */
                    }
                    cameraInputRef.current?.click();
                  }}
                  className="flex items-center justify-center gap-2 bg-gray-500 text-white py-2.5 px-3 rounded-lg hover:bg-gray-600 transition font-medium text-sm"
                  title="Peut fermer l'app sur certains Android"
                >
                  Caméra native
                </button>
                <button
                  onClick={() => {
                    debugLog('scanner:gallery_click');
                    fileInputRef.current?.click();
                  }}
                  className="flex items-center justify-center gap-2 bg-gray-500 text-white py-2.5 px-3 rounded-lg hover:bg-gray-600 transition font-medium text-sm"
                >
                  Galerie
                </button>
              </div>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleFile(e.target.files?.[0], 'camera')}
                className="hidden"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFile(e.target.files?.[0], 'gallery')}
                className="hidden"
              />
            </>
          )}

          {view === 'inpage-camera' && (
            <>
              <div className="relative bg-black rounded-lg overflow-hidden select-none">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onClick={tapToFocus}
                  onTouchStart={tapToFocus}
                  className="w-full h-auto max-h-[38vh] object-contain cursor-crosshair"
                />
                {focusIndicator && (
                  <div
                    key={focusIndicator.key}
                    className="pointer-events-none absolute w-16 h-16 -ml-8 -mt-8 border-2 border-yellow-400 rounded-md animate-focus-pulse"
                    style={{
                      left: `${focusIndicator.x}px`,
                      top: `${focusIndicator.y}px`,
                    }}
                  />
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
                  <div className="bg-black bg-opacity-70 text-white text-xs px-3 py-1.5 rounded text-center max-w-[90%]">
                    {capabilities?.focusDistance
                      ? 'Focus manuel + Capturer en bas'
                      : "Touche le code pour faire la mise au point"}
                  </div>
                </div>
              </div>

              {/* Action bar — ALWAYS VISIBLE right below video */}
              <div className="flex gap-2">
                <button
                  onClick={resetToInitial}
                  disabled={capturing}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition font-semibold disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={capturePhoto}
                  disabled={capturing}
                  className="flex-[2] flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-blue-400"
                >
                  {capturing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                      <span>Capture…</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                      </svg>
                      <span>Capturer</span>
                    </>
                  )}
                </button>
              </div>

              {/* Collapsible settings */}
              <button
                onClick={() => setShowSettings((v) => !v)}
                className="w-full flex items-center justify-between py-2 px-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                <span>⚙️ Réglages caméra</span>
                <span className="text-gray-500">{showSettings ? '▲' : '▼'}</span>
              </button>

              {showSettings && (
                <div className="space-y-3 border border-gray-200 rounded-lg p-3 bg-gray-50">
                  {/* Device picker — if multiple rear cameras are available */}
                  {videoDevices.length > 1 && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Caméra</label>
                      <select
                        value={selectedDeviceId || ''}
                        onChange={(e) => {
                          setSelectedDeviceId(e.target.value);
                          localStorage.setItem('preferredCameraId', e.target.value);
                          startInPageCamera(e.target.value);
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
                      >
                        {videoDevices.map((d, i) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label || `Caméra ${i + 1}`}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Caméra sélectionnée mémorisée pour les prochains scans.
                      </p>
                    </div>
                  )}

                  {/* Manual focus slider — when driver supports focusDistance */}
                  {capabilities?.focusDistance && focusValue !== null && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Focus (manuel)</span>
                        <span className="text-gray-500">près ← → loin</span>
                      </div>
                      <input
                        type="range"
                        min={capabilities.focusDistance.min}
                        max={
                          capabilities.focusDistance.max > 1000
                            ? 100
                            : capabilities.focusDistance.max
                        }
                        step={
                          capabilities.focusDistance.max > 1000
                            ? 1
                            : capabilities.focusDistance.step || 1
                        }
                        value={focusValue > 1000 ? 50 : focusValue}
                        onChange={(e) => applyFocus(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  )}

                  {/* Zoom slider — when supported */}
                  {capabilities?.zoom && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Zoom</span>
                        <span className="text-gray-500">{zoomValue.toFixed(1)}×</span>
                      </div>
                      <input
                        type="range"
                        min={capabilities.zoom.min}
                        max={capabilities.zoom.max}
                        step={capabilities.zoom.step || 0.1}
                        value={zoomValue}
                        onChange={(e) => applyZoom(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  )}

                  {/* Flash / torch toggle — when supported */}
                  {capabilities?.torch && (
                    <button
                      onClick={toggleTorch}
                      className={`w-full py-2 rounded-lg font-medium text-sm transition ${
                        torchOn ? 'bg-yellow-400 text-gray-900' : 'bg-white text-gray-700 border border-gray-300'
                      }`}
                    >
                      {torchOn ? '💡 Flash ON' : '🔦 Flash OFF'}
                    </button>
                  )}

                  {capabilities && (
                    <div className="text-xs">
                      <button
                        onClick={() => setShowCaps((v) => !v)}
                        className="text-blue-600 hover:text-blue-700 underline"
                      >
                        {showCaps ? 'Masquer' : 'ℹ️ Infos caméra'}
                      </button>
                      {showCaps && (
                        <pre className="mt-2 bg-white p-2 rounded border border-gray-200 overflow-x-auto text-[10px]">
                          {JSON.stringify(
                            {
                              focusModes: capabilities.focusMode,
                              focusDistance: capabilities.focusDistance,
                              pointsOfInterest: !!capabilities.pointsOfInterest,
                              zoom: capabilities.zoom,
                              torch: capabilities.torch,
                              width: capabilities.width,
                              height: capabilities.height,
                            },
                            null,
                            2
                          )}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {view === 'preview' && previewUrl && (
            <>
              <img
                src={previewUrl}
                alt="Aperçu de la carte"
                className="w-full rounded-lg border border-gray-200 max-h-[60vh] object-contain"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optionnel)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder='ex: "relief doré sur le dragon, logo ULTRA en bas à droite"'
                  rows={2}
                  maxLength={300}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Aide l'IA en décrivant ce qui est difficile à lire.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={resetToInitial}
                  disabled={scanning}
                  className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg hover:bg-gray-300 transition font-semibold disabled:opacity-50"
                >
                  Reprendre
                </button>
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-blue-400"
                >
                  {scanning ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      <span>Analyse…</span>
                    </>
                  ) : (
                    'Identifier la carte'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CardScanner;
