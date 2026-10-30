"""
Multi-Model Plant Disease Inference Engine (ONNX Runtime)
──────────────────────────────────────────────────────────
Runs MobileNetV2 + EfficientNet-B0 (PlantVillage 38 classes) alongside
the existing YOLO model — all via ONNX Runtime (no PyTorch needed).

Usage (called from app.py):
    from multi_model import MultiModelInference
    engine = MultiModelInference()
    result = engine.predict(pil_image, crop_name="Banana")
"""

import os
import json
import numpy as np
import onnxruntime as ort
from PIL import Image

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(__file__)
MODELS_DIR = os.path.join(BASE_DIR, "onnx_models_data")  # pretrained class_names.json here
ONNX_DIR = os.path.join(BASE_DIR, "onnx_models_data")    # .onnx model files here
CLASS_NAMES_PATH = os.path.join(MODELS_DIR, "class_names.json")
MOBILENET_ONNX = os.path.join(ONNX_DIR, "mobilenetv2_plant.onnx")
EFFICIENTNET_ONNX = os.path.join(ONNX_DIR, "efficientnet_plant.onnx")

# ── PlantVillage 38 class names (fallback if json not present) ─────────────────
DEFAULT_CLASSES = [
    "Apple___Apple_scab",
    "Apple___Black_rot",
    "Apple___Cedar_apple_rust",
    "Apple___healthy",
    "Blueberry___healthy",
    "Cherry_(including_sour)___Powdery_mildew",
    "Cherry_(including_sour)___healthy",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_(maize)___healthy",
    "Grape___Black_rot",
    "Grape___Esca_(Black_Measles)",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "Grape___healthy",
    "Orange___Haunglongbing_(Citrus_greening)",
    "Peach___Bacterial_spot",
    "Peach___healthy",
    "Pepper,_bell___Bacterial_spot",
    "Pepper,_bell___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Raspberry___healthy",
    "Soybean___healthy",
    "Squash___Powdery_mildew",
    "Strawberry___Leaf_scorch",
    "Strawberry___healthy",
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus",
    "Tomato___healthy",
]

# ── ImageNet normalization constants ───────────────────────────────────────────
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# ── Crop name mapping: PlantVillage label prefix → UI crop name ────────────────
_PV_CROP_MAP = {
    "Apple":                  "Apple",
    "Blueberry":              "Blueberry",
    "Cherry_(including_sour)": "Cherry",
    "Corn_(maize)":           "Corn",
    "Grape":                  "Grape",
    "Orange":                 "Orange",
    "Peach":                  "Peach",
    "Pepper,_bell":           "Pepper",
    "Potato":                 "Potato",
    "Raspberry":              "Raspberry",
    "Soybean":                "Soybean",
    "Squash":                 "Squash",
    "Strawberry":             "Strawberry",
    "Tomato":                 "Tomato",
}


def _build_crop_index_map(class_names):
    """Return {crop_ui_name: [class_index, ...]}"""
    mapping = {}
    for idx, cls in enumerate(class_names):
        parts = cls.split("___")
        pv_crop = parts[0]
        ui_crop = _PV_CROP_MAP.get(pv_crop, pv_crop)
        mapping.setdefault(ui_crop.lower(), []).append(idx)
    return mapping


def _friendly_name(raw_class: str) -> str:
    """Convert 'Tomato___Late_blight' → 'Late Blight' """
    parts = raw_class.split("___")
    disease = parts[-1] if len(parts) > 1 else parts[0]
    return disease.replace("_", " ").strip()


def _full_friendly_name(raw_class: str) -> str:
    """Convert 'Tomato___Late_blight' → 'Tomato Late Blight' """
    return raw_class.replace("___", " ").replace("_", " ").strip()


def _softmax(x):
    """Compute softmax for a 1-D array."""
    e = np.exp(x - np.max(x))
    return e / e.sum()


def _preprocess(pil_image: Image.Image) -> np.ndarray:
    """
    Preprocess PIL image for ONNX inference.
    Returns numpy array of shape (1, 3, 224, 224) as float32.
    """
    img = pil_image.convert("RGB").resize((224, 224), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32) / 255.0  # (224, 224, 3)
    arr = (arr - MEAN) / STD                        # normalize
    arr = arr.transpose(2, 0, 1)                    # (3, 224, 224)
    return arr[np.newaxis, ...]                      # (1, 3, 224, 224)


class MultiModelInference:
    """Loads MobileNetV2 + EfficientNet-B0 ONNX models for PlantVillage 38 classes."""

    def __init__(self):
        # Load class names
        if os.path.exists(CLASS_NAMES_PATH):
            with open(CLASS_NAMES_PATH) as f:
                self.class_names = json.load(f)
        else:
            self.class_names = DEFAULT_CLASSES

        self.num_classes = len(self.class_names)
        self.crop_index_map = _build_crop_index_map(self.class_names)

        # ONNX Runtime session options (optimize for CPU)
        sess_opts = ort.SessionOptions()
        sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        sess_opts.intra_op_num_threads = 2
        sess_opts.inter_op_num_threads = 2

        # Load ONNX models
        self.mobilenet = self._load_session(MOBILENET_ONNX, "MobileNetV2", sess_opts)
        self.efficientnet = self._load_session(EFFICIENTNET_ONNX, "EfficientNet", sess_opts)

        print(
            f"[+] Multi-model ONNX engine ready  |  classes={self.num_classes}")
        print(f"   MobileNetV2 :  {'loaded' if self.mobilenet else 'FAILED'}")
        print(
            f"   EfficientNet:  {'loaded' if self.efficientnet else 'FAILED'}")

    def _load_session(self, onnx_path, name, sess_opts):
        """Load an ONNX Runtime session."""
        try:
            if os.path.exists(onnx_path):
                session = ort.InferenceSession(onnx_path, sess_opts,
                                                providers=["CPUExecutionProvider"])
                print(f"  [+] {name} ONNX loaded from {onnx_path}")
                return session
            else:
                print(f"  [-] {name}: ONNX file not found at {onnx_path}")
                return None
        except Exception as e:
            print(f"  [-] {name} ONNX load error: {e}")
            return None

    # ── Single-model inference ─────────────────────────────────────────────────

    def _infer(self, session, input_data, crop_name=None):
        """
        Run inference for one ONNX model.
        If crop_name is given and matches PlantVillage crops,
        restrict prediction to that crop's classes only.
        Returns (raw_class, confidence_pct, class_index).
        """
        if session is None:
            return None, 0.0, -1

        input_name = session.get_inputs()[0].name
        outputs = session.run(None, {input_name: input_data})
        logits = outputs[0][0]  # shape: (num_classes,)
        probs = _softmax(logits)

        # Optionally restrict to crop-specific classes
        crop_key = (crop_name or "").strip().lower()
        if crop_key and crop_key in self.crop_index_map:
            indices = self.crop_index_map[crop_key]
            mask = np.zeros_like(probs)
            for i in indices:
                mask[i] = probs[i]
            # Re-normalize among the crop's classes
            total = mask.sum()
            if total > 0:
                probs = mask / total

        best_idx = int(np.argmax(probs))
        best_conf = float(probs[best_idx]) * 100.0
        raw_class = self.class_names[best_idx]
        return raw_class, round(best_conf, 2), best_idx

    # ── Main prediction ────────────────────────────────────────────────────────

    def predict(self, pil_image: Image.Image, crop_name: str = ""):
        """
        Run both MobileNetV2 and EfficientNet on the image.
        Returns list of prediction dicts sorted by confidence (highest first):
        [
            {
                "model": "mobilenetv2",
                "raw_class": "Tomato___Late_blight",
                "disease": "Late Blight",
                "full_label": "Tomato Late Blight",
                "confidence": 94.23,
                "is_healthy": False,
            },
            ...
        ]
        """
        input_data = _preprocess(pil_image)

        results = []

        # MobileNetV2
        raw_cls, conf, _ = self._infer(self.mobilenet, input_data, crop_name)
        if raw_cls:
            results.append({
                "model": "mobilenetv2",
                "raw_class": raw_cls,
                "disease": _friendly_name(raw_cls),
                "full_label": _full_friendly_name(raw_cls),
                "confidence": conf,
                "is_healthy": "healthy" in raw_cls.lower(),
            })

        # EfficientNet
        raw_cls, conf, _ = self._infer(
            self.efficientnet, input_data, crop_name)
        if raw_cls:
            results.append({
                "model": "efficientnet",
                "raw_class": raw_cls,
                "disease": _friendly_name(raw_cls),
                "full_label": _full_friendly_name(raw_cls),
                "confidence": conf,
                "is_healthy": "healthy" in raw_cls.lower(),
            })

        # Sort by confidence descending
        results.sort(key=lambda r: r["confidence"], reverse=True)
        return results

    def get_supported_crops(self):
        """Return list of PlantVillage-supported crop names."""
        seen = set()
        crops = []
        for cls in self.class_names:
            pv_crop = cls.split("___")[0]
            ui_crop = _PV_CROP_MAP.get(pv_crop, pv_crop)
            if ui_crop.lower() not in seen:
                seen.add(ui_crop.lower())
                crops.append(ui_crop)
        return sorted(crops)
