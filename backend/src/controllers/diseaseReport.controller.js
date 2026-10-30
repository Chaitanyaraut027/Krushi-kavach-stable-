import asyncHandler from "express-async-handler";
import DiseaseReport from "../models/diseaseReport.model.js";
import Crop from "../models/crop.model.js";
import Media from "../models/media.model.js";
import { uploadToCloudinary } from "../services/cloudinary.service.js";
import { analyzeCropDisease } from "../services/diseaseDetection.service.js";
import { sendWhatsAppReport } from "../services/whatsapp.service.js";
import axios from "axios";
import FormData from "form-data";

// ML server URL (local or Render hosted)
const getMlServerUrl = () => process.env.ML_SERVER_URL || "http://localhost:8000";

// Forward prediction request to FastAPI ML server
const requestPrediction = async ({ buffer, originalName, mimeType, cropName }) => {
  const formData = new FormData();
  formData.append("file", buffer, {
    filename: originalName || "upload.jpg",
    contentType: mimeType || "image/jpeg",
  });
  if (cropName) formData.append("crop", cropName);

  return axios.post(`${getMlServerUrl()}/predict`, formData, {
    headers: formData.getHeaders(),
    timeout: 60000,
  });
};

// --------------------------------------------------------------
// Create detailed report with images and Gemini analysis
export const createReport = asyncHandler(async (req, res) => {
  const { cropId, reportLanguage } = req.body;

  const crop = await Crop.findById(cropId);
  if (!crop) return res.status(404).json({ message: "Crop not found" });

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "Please upload images." });
  }

  // Upload images to Cloudinary
  const mediaIds = [];
  for (const file of req.files) {
    const upload = await uploadToCloudinary(file, "disease-reports");
    const mediaDoc = await Media.create({ url: upload.secure_url });
    mediaIds.push(mediaDoc._id);
  }

  // Gemini disease analysis
  const analysis = await analyzeCropDisease(
    req.files,
    { cropName: crop.name, cropVariety: crop.variety },
    reportLanguage || "en"
  );

  const report = await DiseaseReport.create({
    farmer: req.user.id,
    crop: crop._id,
    images: mediaIds,
    reportLanguage,
    analysis,
    reportStatus: "pending_action",
  });

  res.status(201).json({ message: "Report created", report });
});

// Fetch reports submitted by the logged-in farmer
export const getFarmerReports = asyncHandler(async (req, res) => {
  const reports = await DiseaseReport.find({ farmer: req.user.id })
    .populate("crop images assignedAgronomist");

  res.json(reports);
});

// Mark report status as treated
export const markReportTreated = asyncHandler(async (req, res) => {
  const report = await DiseaseReport.findById(req.params.id);

  if (!report || report.farmer.toString() !== req.user.id) {
    return res.status(404).json({ message: "Report not found" });
  }

  report.reportStatus = "treated";
  await report.save();

  res.json({ message: "Report marked as treated", report });
});

// Delete a disease report
export const deleteReport = asyncHandler(async (req, res) => {
  const report = await DiseaseReport.findById(req.params.id);

  if (!report || report.farmer.toString() !== req.user.id) {
    return res.status(404).json({ message: "Report not found" });
  }

  await DiseaseReport.findByIdAndDelete(req.params.id);

  res.json({ message: "Report deleted successfully" });
});

// Detect disease via ONNX ML server
export const detectDiseaseML = asyncHandler(async (req, res) => {
  const { cropName } = req.body;

  if (!req.file) return res.status(400).json({ message: "Please upload an image." });
  if (!cropName) return res.status(400).json({ message: "Provide crop name." });

  const normalizedCrop = cropName;

  try {
    let prediction = "Unknown";
    let confidence = 0;
    let mlData = {};
    let isAiAnalyzed = false;

    // Send prediction request to ML server
    try {
      const mlResponse = await requestPrediction({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        cropName: normalizedCrop,
      });
      mlData = mlResponse.data;
      prediction = mlData.predicted_class || mlData.class || mlData.disease || "Unknown";
      let conf = parseFloat(mlData.confidence || 0);
      confidence = conf <= 1 ? (conf * 100) : conf;
    } catch (err) {
      console.warn("[ML] Local server unavailable or failed:", err.message);
    }

    confidence = Number(confidence.toFixed(2));

    // Upload image to Cloudinary for permanent storage
    const cloudinaryResult = await uploadToCloudinary(req.file, "disease-reports");

    const report = await DiseaseReport.create({
      farmer: req.user.id,
      cropName: normalizedCrop,
      prediction,
      confidence,
      imageURL: cloudinaryResult.secure_url,
      reportStatus: "pending_action",
    });

    res.json({
      success: true,
      message: isAiAnalyzed ? "Disease detected via AI analysis" : "Disease detected",
      yield_estimation: mlData.yield_estimation || "N/A",
      details: mlData.details || {},
      report: {
        _id: report._id,
        prediction,
        confidence,
        cropName: normalizedCrop,
        imageURL: report.imageURL,
        createdAt: report.createdAt,
      },
    });

    // Send WhatsApp notification if user has a mobile number
    try {
      if (req.user.mobileNumber) {
        sendWhatsAppReport({
          to: req.user.mobileNumber,
          farmerName: req.user.fullName,
          cropName: normalizedCrop,
          diseaseName: prediction,
          confidence: confidence,
          imageURL: report.imageURL,
          summary: mlData.details?.diagnosis || "",
        });
      }
    } catch (wsErr) {
      console.error("[WhatsApp] Automation trigger failed:", wsErr.message);
    }

  } catch (error) {
    console.error("ML prediction error:", error.message);

    if (error.code === "ECONNREFUSED" || error.message.includes("ECONNREFUSED")) {
      return res.status(503).json({
        message: "ML server is not running. Please start it: cd crop_project && python app.py",
        error: "ML_SERVER_OFFLINE",
      });
    }

    return res.status(500).json({
      message: "ML prediction failed",
      error: error.message,
    });
  }
});

// Identify crop and check plant relevance via ML server
export const identifyCropML = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Please upload an image." });

  try {
    const formData = new FormData();
    formData.append("file", req.file.buffer, {
      filename: req.file.originalname || "upload.jpg",
      contentType: req.file.mimetype || "image/jpeg",
    });

    const mlResponse = await axios.post(`${getMlServerUrl()}/identify-crop`, formData, {
      headers: formData.getHeaders(),
      timeout: 60000,
    });

    let resData = mlResponse.data;
    if (resData.detectedCrop) {
      resData.detectedCrop = resData.detectedCrop
        .replace(/_\(maize\)/i, '')
        .replace(/,.*$/i, '')
        .replace(/_/g, ' ')
        .split(' ')[0];
      resData.detectedCrop = resData.detectedCrop.charAt(0).toUpperCase() + resData.detectedCrop.slice(1).toLowerCase();
    }

    res.json(resData);
  } catch (error) {
    console.warn("Crop identification fallback:", error.message);
    res.json({
      relevant: true,
      detectedCrop: null,
      confidence: 0,
      message: "Could not auto-identify crop. Please select your crop manually."
    });
  }
});
