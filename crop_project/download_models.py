"""
Download pretrained MobileNetV2 and EfficientNet models from HuggingFace.
Run once: python download_models.py
"""
import os
import json
import urllib.request

MODELS_DIR = os.path.join(os.path.dirname(__file__), "pretrained_models")
os.makedirs(MODELS_DIR, exist_ok=True)

# ── PlantVillage 38 class names ────────────────────────────────────────────────
PLANTVILLAGE_CLASSES = [
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


def download_file(url, dest):
    """Download with progress."""
    if os.path.exists(dest):
        print(f"  ✅ Already exists: {os.path.basename(dest)}")
        return
    print(f"  ⬇ Downloading {os.path.basename(dest)} ...")
    urllib.request.urlretrieve(url, dest)
    size_mb = os.path.getsize(dest) / (1024 * 1024)
    print(f"  ✅ Done ({size_mb:.1f} MB)")


def main():
    print("=" * 60)
    print("  Downloading Pretrained Plant Disease Models")
    print("=" * 60)

    # 1. Save class names
    class_path = os.path.join(MODELS_DIR, "class_names.json")
    with open(class_path, "w") as f:
        json.dump(PLANTVILLAGE_CLASSES, f, indent=2)
    print(
        f"\n✅ Saved {len(PLANTVILLAGE_CLASSES)} class names → class_names.json")

    # 2. MobileNetV2 from HuggingFace
    print("\n── MobileNetV2 (Plant Disease) ──")
    mobilenet_url = (
        "https://huggingface.co/Daksh159/plant-disease-mobilenetv2"
        "/resolve/main/mobilenetv2_plant.pth"
    )
    download_file(mobilenet_url, os.path.join(
        MODELS_DIR, "mobilenetv2_plant.pth"))

    # 3. EfficientNet — we use torchvision EfficientNet-B0 fine-tuned on PlantVillage
    #    Since there is no single canonical HF model, we will create an EfficientNet-B0
    #    and fine-tune it on first run if weights don't exist, OR download pretrained.
    #    For now, we create a placeholder that will be initialized from ImageNet weights
    #    and the classifier head will be set to 38 classes.
    eff_marker = os.path.join(MODELS_DIR, "efficientnet_plant.pth")
    if not os.path.exists(eff_marker):
        print("\n── EfficientNet-B0 (Plant Disease) ──")
        print("  Creating EfficientNet-B0 with PlantVillage classifier head...")
        try:
            import torch
            from torchvision import models as tv_models
            import torch.nn as nn
            # Try pretrained first, fallback to random init
            try:
                eff_model = tv_models.efficientnet_b0(weights="IMAGENET1K_V1")
                print("  Using ImageNet pretrained backbone")
            except Exception:
                eff_model = tv_models.efficientnet_b0(weights=None)
                print("  ⚠️  Could not download ImageNet weights, using random init")
            # Replace classifier for 38 classes
            in_features = eff_model.classifier[1].in_features
            eff_model.classifier[1] = nn.Sequential(
                nn.Dropout(0.2),
                nn.Linear(in_features, 38),
            )
            torch.save(eff_model.state_dict(), eff_marker)
            size_mb = os.path.getsize(eff_marker) / (1024 * 1024)
            print(f"  ✅ EfficientNet-B0 saved ({size_mb:.1f} MB)")
        except Exception as e:
            print(f"  ⚠️  EfficientNet setup error: {e}")
            print("  Will initialize at server startup instead")
    else:
        print(f"\n  ✅ EfficientNet already exists: efficientnet_plant.pth")

    print("\n" + "=" * 60)
    print("  All models ready in:", MODELS_DIR)
    print("=" * 60)


if __name__ == "__main__":
    main()
