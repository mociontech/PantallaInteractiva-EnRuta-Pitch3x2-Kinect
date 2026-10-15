/*
 * Worker clásico: corre el modelo de pose FUERA del hilo de la interfaz.
 * Antes la inferencia (10-30 ms por fotograma) bloqueaba animaciones y cursor; ahora la interfaz solo recibe los resultados.
 * vision_bundle.js es la versión "IIFE" de @mediapipe/tasks-vision (define el global `Vision`).
 */
importScripts('/mediapipe/vision_bundle.js');

let landmarker = null;

async function create(m, delegate) {
  const fileset = await Vision.FilesetResolver.forVisionTasks(m.wasmPath);
  return Vision.PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: m.modelPath, delegate },
    runningMode: 'VIDEO',
    numPoses: m.numPoses,
    minPoseDetectionConfidence: m.confidence,
    minPosePresenceConfidence: m.confidence,
    minTrackingConfidence: m.confidence,
  });
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.t === 'init') {
      try {
        landmarker = await create(m, 'GPU');
        self.postMessage({ t: 'ready', delegate: 'GPU' });
      } catch (gpuErr) {
        landmarker = await create(m, 'CPU'); // sin GPU en el worker: sigue fuera del hilo principal, más lento
        self.postMessage({ t: 'ready', delegate: 'CPU' });
      }
    } else if (m.t === 'frame' && landmarker) {
      const t0 = performance.now();
      const res = landmarker.detectForVideo(m.bitmap, m.ts);
      m.bitmap.close();
      self.postMessage({
        t: 'result',
        ts: m.ts,
        ms: performance.now() - t0,
        landmarks: res.landmarks.map((l) => l.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility }))),
      });
    }
  } catch (err) {
    self.postMessage({ t: 'error', message: String((err && err.message) || err) });
  }
};
