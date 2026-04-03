"""
Krishi Kavach – Local ML Inference Server (Multi-Model Ensemble)
──────────────────────────────────────────────────────────────────
YOLO (Banana/Chilli/Radish/Groundnut/Cauliflower)
+ MobileNetV2 + EfficientNet-B0 (PlantVillage 38 classes)

Run: python app.py   (starts on http://localhost:8000)
"""

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image
import io
import os
import uvicorn
from dotenv import load_dotenv
from youtube_search import search_disease_videos
from multi_model import MultiModelInference

# Groq/Gemini disabled as per user request
GROQ_API_KEY = ""

# ── Model paths ───────────────────────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__),
                          "runs", "detect", "train", "weights", "best.pt")

app = FastAPI(title="Krishi Kavach ML Server", version="3.0")

# Allow requests from the Node backend (localhost:5000) and Vite dev (localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── YOLO crops that the existing model supports (First Row Crops) ─────────────
# As per user request: First row contains these 5 crops.
FIRST_ROW_CROPS = {"banana", "chilli", "radish", "groundnut", "cauliflower"}

# ── Load YOLO model once at startup ──────────────────────────────────────────
print(f"Loading YOLO model from: {MODEL_PATH}")
yolo_model = YOLO(MODEL_PATH)
CLASS_NAMES = yolo_model.names          # {0: 'class_name', ...}
print(f"YOLO model loaded. Classes: {CLASS_NAMES}")

# ── Load MobileNetV2 + EfficientNet ensemble ────────────────────────────────
print("\nLoading multi-model ensemble (MobileNetV2 + EfficientNet)...")
multi_engine = MultiModelInference()
print(f"PlantVillage crops: {multi_engine.get_supported_crops()}\n")


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/")
@app.get("/health")
def health():
    pv_crops = multi_engine.get_supported_crops()
    return {
        "status": "running",
        "model": "best.pt (Krishi Kavach v3 — Multi-Model Ensemble)",
        "yolo_crops": list(FIRST_ROW_CROPS),
        "plantvillage_crops": pv_crops,
        "all_supported_crops": sorted(set(
            [c.capitalize() for c in FIRST_ROW_CROPS] + pv_crops
        )),
        "yolo_classes": CLASS_NAMES,
        "models": ["yolo", "mobilenetv2", "efficientnet"],
    }


# ── Prediction endpoint (multi-model ensemble) ───────────────────────────────
@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    crop: str = Form(default=""),
    language: str = Form(default="english")
):
    # Read image bytes
    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file.")

    crop_lower = crop.strip().lower()
    
    # ── RULE ──────────────────────────────────────────────────────────────────
    # 1. Row 1 Crops (First 5): Use YOLO + MobileNetV2 + EfficientNet
    # 2. Other Crops: Use only MobileNetV2 + EfficientNet
    # ──────────────────────────────────────────────────────────────────────────
    is_first_row_crop = crop_lower in FIRST_ROW_CROPS

    all_predictions = []  # collect {model, predicted_class, confidence, ...}

    # ── 1. YOLO inference (ONLY if it's a first-row crop) ─────────────────────
    if is_first_row_crop:
        results = yolo_model(image, verbose=False)
        if results and len(results) > 0:
            result = results[0]
            if result.boxes is not None and len(result.boxes) > 0:
                boxes = result.boxes
                confs = boxes.conf.tolist()
                class_ids = boxes.cls.tolist()
                best_idx = confs.index(max(confs))
                best_conf = round(confs[best_idx] * 100, 2)
                best_class = CLASS_NAMES[int(class_ids[best_idx])]
                all_predictions.append({
                    "model": "yolo",
                    "predicted_class": best_class,
                    "confidence": best_conf,
                    "is_healthy": "healthy" in best_class.lower(),
                })

    # ── 2. MobileNetV2 + EfficientNet inference (always run) ──────────────────
    # These are the "other two pretrained models" mentioned by the user.
    pv_results = multi_engine.predict(image, crop_name=crop)
    for pv in pv_results:
        all_predictions.append({
            "model": pv["model"],
            "predicted_class": pv["raw_class"],
            "confidence": pv["confidence"],
            "disease": pv["disease"],
            "full_label": pv["full_label"],
            "is_healthy": pv["is_healthy"],
        })

    # ── 3. Pick best prediction across all models (Highest Confidence) ────────
    if not all_predictions:
        return {
            "predicted_class": "Healthy",
            "confidence": 0.0,
            "crop": crop,
            "model_used": "none",
            "detections": [],
        }

    # Sort by confidence descending
    all_predictions.sort(key=lambda p: p["confidence"], reverse=True)
    best = all_predictions[0]

    # ── 4. YouTube Recommendations ───────────────────────────────────────────
    recommended_videos = []
    if not best.get("is_healthy", False):
        try:
            # Clean up class name for search (e.g. 'Tomato___Late_blight' -> 'Late Blight')
            disease_class = best["predicted_class"]
            if "___" in disease_class:
                disease_name = disease_class.split("___")[-1].replace("_", " ")
            else:
                disease_name = disease_class.replace("_", " ").replace(crop_lower, "").strip()
            
            recommended_videos = search_disease_videos(
                crop_name=crop or disease_class.split("___")[0],
                disease_name=disease_name,
                language=language,
                max_results=5,
                api_key=GROQ_API_KEY
            )
        except Exception as e:
            print(f"⚠ YouTube search failed during prediction: {e}")

    return {
        "predicted_class": best["predicted_class"],
        "confidence":      best["confidence"],
        "crop":            crop,
        "model_used":      best["model"],
        "detections":      all_predictions,
        "recommended_videos": recommended_videos,
    }


# ── Crop Identification endpoint ──────────────────────────────────────────────
@app.post("/identify-crop")
async def identify_crop(file: UploadFile = File(...)):
    """
    Identify if the uploaded image is a relevant plant/crop.
    Uses the ensemble to check for high-confidence matches.
    """
    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file.")

    # Run ensemble
    results = multi_engine.predict(image)
    if not results:
        return {"relevant": False, "detectedCrop": "Other", "confidence": 0}

    best = results[0]
    # If the ensemble is confident (>40%) in any PlantVillage crop, we consider it relevant
    is_relevant = best["confidence"] > 40.0
    
    return {
        "relevant": is_relevant,
        "detectedCrop": best["full_label"].split()[0], # Get the crop part
        "confidence": best["confidence"],
        "explanation": f"Detected {best['full_label']} via {best['model']}"
    }


# ── YouTube Disease Video Recommendation ──────────────────────────────────────
@app.get("/youtube-recommend")
async def youtube_recommend(
    crop: str = Query(..., description="Crop name, e.g. Banana"),
    disease: str = Query(..., description="Disease name, e.g. Sigatoka"),
    language: str = Query(
        "english", description="Language: english, hindi, or marathi"),
    max_results: int = Query(5, ge=1, le=10, description="Number of results"),
):
    """
    Get YouTube video recommendations for treating a specific crop disease.
    Returns the best videos ranked by relevance.
    """
    if not crop or not disease:
        raise HTTPException(
            status_code=400, detail="crop and disease are required")

    try:
        videos = search_disease_videos(
            crop_name=crop.strip(),
            disease_name=disease.strip(),
            language=language.strip(),
            max_results=max_results,
            api_key=GROQ_API_KEY,
        )
        return {
            "crop": crop,
            "disease": disease,
            "language": language,
            "count": len(videos),
            "videos": videos,
        }
    except Exception as e:
        print(f"❌ YouTube recommend error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── YouTube Video Search (POST version for Node backend) ──────────────────────
@app.post("/youtube-search")
async def youtube_search(
    query: str = Form(..., description="Full search query"),
    language: str = Form("english", description="User language"),
    max_duration: int = Form(20, description="Max video duration in minutes"),
):
    """
    Handle generic YouTube search requests from the Node backend.
    """
    try:
        from youtubesearchpython import VideosSearch
        
        print(f"🔍 Generic YouTube search: '{query}' ({language})")
        vs = VideosSearch(query, limit=10)
        results = vs.result().get("result", [])
        
        videos = []
        for item in results:
            videos.append({
                "id": item.get("id"),
                "title": item.get("title"),
                "url": item.get("link"),
                "thumbnail": item.get("thumbnails", [{}])[-1].get("url"),
                "duration": item.get("duration"),
                "channel": item.get("channel", {}).get("name"),
                "views": item.get("viewCount", {}).get("short", "0 views"),
            })
            
        return {"success": True, "videos": videos}
    except Exception as e:
        print(f"❌ YouTube search error: {e}")
        return {"success": False, "error": str(e)}


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
