"""
Krishi Kavach – ML Inference Server (ONNX Runtime)
────────────────────────────────────────────────────
Three-model ensemble:
  • YOLO          — Banana, Chilli, Radish, Groundnut, Cauliflower
  • MobileNetV2   — PlantVillage 38 classes
  • EfficientNet  — PlantVillage 38 classes

All models run via ONNX Runtime (no PyTorch / Ultralytics needed).

Run locally: python app.py  →  http://localhost:8000
Deploy:      Docker + render.yaml (see Dockerfile / render.yaml)
"""

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io
import os
import json
import numpy as np
import onnxruntime as ort
import uvicorn
from multi_model import MultiModelInference

# ── Model paths ───────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(__file__)
ONNX_DIR   = os.path.join(BASE_DIR, "onnx_models_data")
YOLO_PATH  = os.path.join(ONNX_DIR, "yolo_best.onnx")
YOLO_NAMES = os.path.join(ONNX_DIR, "yolo_class_names.json")

# Crops handled by YOLO (in addition to the ensemble)
YOLO_CROPS = {"banana", "chilli", "radish", "groundnut", "cauliflower"}

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title="Krishi Kavach ML Server", version="4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── YOLO helpers ──────────────────────────────────────────────────────────────

def load_yolo():
    """Load YOLO ONNX session and class name map."""
    if not os.path.exists(YOLO_PATH):
        print(f"[-] YOLO ONNX not found at {YOLO_PATH}")
        return None, {}

    opts = ort.SessionOptions()
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    opts.intra_op_num_threads = 2
    opts.inter_op_num_threads = 2

    session = ort.InferenceSession(YOLO_PATH, opts, providers=["CPUExecutionProvider"])

    names = {}
    if os.path.exists(YOLO_NAMES):
        with open(YOLO_NAMES) as f:
            names = {int(k): v for k, v in json.load(f).items()}

    print(f"[+] YOLO loaded - classes: {names}")
    return session, names


def yolo_preprocess(pil_image, size=640):
    """Letterbox-resize + normalise to (1, 3, 640, 640) float32."""
    img = np.array(pil_image.convert("RGB"))
    h, w = img.shape[:2]
    scale  = min(size / h, size / w)
    new_h, new_w = int(h * scale), int(w * scale)
    resized = np.array(pil_image.convert("RGB").resize((new_w, new_h), Image.BILINEAR))

    pad_h = (size - new_h) // 2
    pad_w = (size - new_w) // 2
    canvas = np.full((size, size, 3), 114, dtype=np.uint8)
    canvas[pad_h:pad_h + new_h, pad_w:pad_w + new_w] = resized

    blob = canvas.astype(np.float32) / 255.0
    blob = blob.transpose(2, 0, 1)[np.newaxis, ...]   # (1, 3, 640, 640)
    return blob


def yolo_postprocess(output, names, conf_thresh=0.25):
    """Extract top detections from YOLOv8 ONNX output (1, 4+C, 8400)."""
    preds = output[0].T          # (8400, 4+C)
    class_probs = preds[:, 4:]
    best_ids    = np.argmax(class_probs, axis=1)
    best_confs  = np.max(class_probs, axis=1)

    mask = best_confs > conf_thresh
    detections = [
        {"class_name": names.get(int(cid), f"cls_{cid}"),
         "confidence": round(float(conf) * 100, 2)}
        for conf, cid in zip(best_confs[mask], best_ids[mask])
    ]
    return sorted(detections, key=lambda d: d["confidence"], reverse=True)


# ── Load models once at startup ───────────────────────────────────────────────
print(f"\nLoading YOLO ONNX from: {YOLO_PATH}")
yolo_session, CLASS_NAMES = load_yolo()

print("\nLoading MobileNetV2 + EfficientNet ensemble (ONNX)...")
multi_engine = MultiModelInference()
print(f"PlantVillage crops: {multi_engine.get_supported_crops()}\n")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
@app.get("/health")
def health():
    """Health check — returns supported crops and loaded models."""
    pv_crops = multi_engine.get_supported_crops()
    return {
        "status": "running",
        "version": "4.0 (ONNX)",
        "yolo_crops": sorted(YOLO_CROPS),
        "plantvillage_crops": pv_crops,
        "all_supported_crops": sorted(set([c.capitalize() for c in YOLO_CROPS] + pv_crops)),
        "models": ["yolo", "mobilenetv2", "efficientnet"],
        "runtime": "onnxruntime",
    }


@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    crop: str = Form(default=""),
):
    """
    Disease prediction endpoint.
    Accepts an image + optional crop name.
    Returns the best prediction across all active models.
    """
    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file.")

    crop_lower = crop.strip().lower()
    all_preds  = []

    # ── 1. YOLO (only for its 5 supported crops) ──────────────────────────────
    if crop_lower in YOLO_CROPS and yolo_session is not None:
        blob   = yolo_preprocess(image)
        name   = yolo_session.get_inputs()[0].name
        output = yolo_session.run(None, {name: blob})
        dets   = yolo_postprocess(output, CLASS_NAMES)
        if dets:
            best = dets[0]
            all_preds.append({
                "model":           "yolo",
                "predicted_class": best["class_name"],
                "confidence":      best["confidence"],
                "is_healthy":      "healthy" in best["class_name"].lower(),
            })

    # ── 2. MobileNetV2 + EfficientNet (always run) ────────────────────────────
    for pv in multi_engine.predict(image, crop_name=crop):
        all_preds.append({
            "model":           pv["model"],
            "predicted_class": pv["raw_class"],
            "confidence":      pv["confidence"],
            "disease":         pv["disease"],
            "full_label":      pv["full_label"],
            "is_healthy":      pv["is_healthy"],
        })

    # ── 3. No detections → return healthy default ─────────────────────────────
    if not all_preds:
        return {
            "predicted_class": "Healthy",
            "confidence":      0.0,
            "crop":            crop,
            "model_used":      "none",
            "detections":      [],
        }

    # ── 4. Pick highest-confidence prediction ─────────────────────────────────
    all_preds.sort(key=lambda p: p["confidence"], reverse=True)
    best = all_preds[0]

    return {
        "predicted_class": best["predicted_class"],
        "confidence":      best["confidence"],
        "crop":            crop,
        "model_used":      best["model"],
        "detections":      all_preds,
    }


@app.post("/identify-crop")
async def identify_crop(file: UploadFile = File(...)):
    """
    Crop identification endpoint.
    Returns whether the image is a recognisable plant/crop and which one.
    """
    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file.")

    results = multi_engine.predict(image)
    if not results:
        return {"relevant": False, "detectedCrop": "Other", "confidence": 0}

    best        = results[0]
    is_relevant = best["confidence"] > 40.0
    crop_name   = best["full_label"].split()[0]
    crop_name   = crop_name.capitalize()

    return {
        "relevant":     is_relevant,
        "detectedCrop": crop_name,
        "confidence":   best["confidence"],
        "explanation":  f"Detected {best['full_label']} via {best['model']}",
    }


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
