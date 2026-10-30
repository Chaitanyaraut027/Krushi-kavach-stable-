import axios from "axios";

/**
 * ML Server Service
 * ─────────────────
 * Connects the Node backend to the FastAPI ONNX ML inference server.
 * In production: connects to https://krishi-kavach-ml.onrender.com
 * In development: connects to local or production fallback
 */
const getMlServerUrl = () =>
  process.env.ML_SERVER_URL || "https://krishi-kavach-ml.onrender.com";

// ── 1. Health Check ─────────────────────────────────────────────────────────
export const checkMLServerStatus = async () => {
  try {
    const res = await axios.get(`${getMlServerUrl()}/health`, { timeout: 30000 });
    const status = String(res.data?.status || "").toLowerCase();
    return status.includes("running");
  } catch (err) {
    console.warn("[ML Health Check Failed]:", err.message);
    return false;
  }
};

// ── 2. Wait for ML Server (handles cold starts) ────────────────────────────
export const waitForMLServer = async (maxWait = 35000) => {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const alive = await checkMLServerStatus();
    if (alive) return true;
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
};

// ── 3. Start Check ─────────────────────────────────────────────────────────
export const startMLServer = async () => {
  const url = getMlServerUrl();
  console.log("[ML] Checking ML server at:", url);
  const ready = await waitForMLServer(35000);
  if (!ready) {
    throw new Error(
      `ML server at ${url} is currently starting up (Render free tier cold start). Please wait 30 seconds and retry.`
    );
  }
  console.log("[ML] ML server is ready at:", url);
};

// ── 4. Run Prediction (Node → FastAPI → result) ─────────────────────────────
export const runPrediction = async (imageBase64) => {
  try {
    const res = await axios.post(
      `${getMlServerUrl()}/predict`,
      { image: imageBase64 },
      { timeout: 60000 }
    );
    return res.data;
  } catch (err) {
    console.error("[ML Prediction Error]:", err.message);
    throw new Error(
      err.response?.data?.detail || "ML prediction server error. Please try again."
    );
  }
};
