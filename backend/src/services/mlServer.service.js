import axios from "axios";

/**
 * ML Server Service
 * ─────────────────
 * Connects the Node backend to the FastAPI ML inference server.
 *
 * In production: set ML_SERVER_URL to your Render deployment URL
 *   e.g. https://krishi-kavach-ml.onrender.com
 *
 * In development: run `python app.py` inside crop_project/
 *   ML server will be available at http://localhost:8000
 */
const getMlServerUrl = () => process.env.ML_SERVER_URL || "http://localhost:8000";

// ── 1. Health Check ─────────────────────────────────────────────────────────
export const checkMLServerStatus = async () => {
  try {
    const res = await axios.get(`${getMlServerUrl()}/health`, { timeout: 8000 });
    const status = String(res.data?.status || "").toLowerCase();
    return status.includes("running");
  } catch {
    return false;
  }
};

// ── 2. Wait for ML Server (used at startup for local dev) ───────────────────
export const waitForMLServer = async (maxWait = 10000) => {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const alive = await checkMLServerStatus();
    if (alive) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
};

// ── 3. Start Check (for local dev only) ────────────────────────────────────
export const startMLServer = async () => {
  const url = getMlServerUrl();
  console.log("[ML] Checking ML server at:", url);
  const ready = await waitForMLServer(10000);
  if (!ready) {
    throw new Error(
      "ML server is not reachable. " +
      "For local dev: cd crop_project && python app.py\n" +
      "For production: set ML_SERVER_URL to your Render URL"
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
      { timeout: 30000 }
    );
    return res.data;
  } catch (err) {
    console.error("[ML] Prediction error:", err.message);
    throw new Error("Failed to get prediction from ML server");
  }
};
