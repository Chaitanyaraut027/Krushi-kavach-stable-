import asyncHandler from "express-async-handler";
import { getCropDiseaseInfo, chatWithAI, getCropManagementInfo, getWeatherCropImpact, getMarketPrices, getSeedAndYieldAdvice } from "../services/gemini.service.js";
import { getCache, setCache } from "../services/cache.service.js";
import User from "../models/user.model.js";

/**
 * POST /api/v1/disease-info/crop-info
 * Body: { cropName, diseaseName, language }
 */
export const fetchCropDiseaseInfo = asyncHandler(async (req, res) => {
    const { cropName, diseaseName, language = "en" } = req.body;

    if (!cropName || !diseaseName) {
        res.status(400);
        throw new Error("cropName and diseaseName are required.");
    }

    // 1. Check Redis cache first (reduces LLM token cost & latency to <10ms)
    const cacheKey = `ai:crop-disease:${cropName.trim().toLowerCase()}:${diseaseName.trim().toLowerCase()}:${language}`;
    const cachedInfo = await getCache(cacheKey);
    if (cachedInfo) {
        return res.json({
            success: true,
            info: cachedInfo,
            cached: true,
            aiError: null
        });
    }

    const user = await User.findById(req.user._id).lean();

    try {
        const info = await getCropDiseaseInfo(cropName, diseaseName, language, user?.groqApiKey);

        // 2. Cache successful AI response for 24 hours
        if (info) {
            await setCache(cacheKey, info, 86400);
        }

        res.json({
            success: true,
            info,
            cached: false,
            aiError: null
        });
    } catch (err) {
        console.error("AI Crop Info Failed:", err?.message);
        res.json({
            success: true,
            info: null,
            cached: false,
            aiError: err?.message || "Failed to fetch AI crop info"
        });
    }
});

/**
 * POST /api/v1/disease-info/chat
 * Body: { messages: [{role, content}], context?: string, language?: string }
 */
export const chatbot = asyncHandler(async (req, res) => {
    const { messages, context = "", language = "en" } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        res.status(400);
        throw new Error("messages array is required.");
    }

    const user = await User.findById(req.user._id).lean();
    const reply = await chatWithAI(messages, context, language, user?.groqApiKey);
    res.json({ success: true, reply });
});

/**
 * POST /api/v1/disease-info/crop-management
 * Body: { cropName, area, areaUnit, language }
 */
export const cropManagement = asyncHandler(async (req, res) => {
    const { cropName, area, areaUnit = "acres", language = "en" } = req.body;

    if (!cropName || !area) {
        res.status(400);
        throw new Error("cropName and area are required.");
    }

    const user = await User.findById(req.user._id).lean();
    const info = await getCropManagementInfo(cropName, parseFloat(area), areaUnit, language, user?.groqApiKey);
    res.json({ success: true, info });
});

/**
 * POST /api/v1/disease-info/weather-crop-impact
 * Body: { cropName, currentWeather, dailyForecast, language }
 */
export const weatherCropImpact = asyncHandler(async (req, res) => {
    const { cropName, currentWeather, dailyForecast, language = "en" } = req.body;

    if (!cropName || !currentWeather || !dailyForecast) {
        res.status(400);
        throw new Error("cropName, currentWeather, and dailyForecast are required.");
    }

    const user = await User.findById(req.user._id).lean();
    const impact = await getWeatherCropImpact(cropName, currentWeather, dailyForecast, language, user?.groqApiKey);
    res.json({ success: true, impact });
});

/**
 * POST /api/v1/disease-info/market-prices
 * Body: { commodity, district?, state? }
 * Uses user's profile district/state if not provided.
 */
export const marketPrices = asyncHandler(async (req, res) => {
    const { commodity, district: bodyDistrict, state: bodyState } = req.body;

    if (!commodity) {
        res.status(400);
        throw new Error("commodity is required.");
    }

    // Use profile location if caller didn't pass one
    let district = bodyDistrict;
    let state = bodyState;
    if (!district || !state) {
        const user = await User.findById(req.user._id).lean();
        district = district || user?.address?.district || "Nashik";
        state = state || "Maharashtra"; // default
    }

    // Check Redis cache for recent price lookup (1h TTL)
    const cacheKey = `market:prices:${commodity.trim().toLowerCase()}:${district.trim().toLowerCase()}:${state.trim().toLowerCase()}`;
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
        return res.json({ success: true, data: cachedData, cached: true });
    }

    const user = await User.findById(req.user._id).lean();
    const data = await getMarketPrices(commodity, district, state, user?.groqApiKey);

    if (data) {
        await setCache(cacheKey, data, 3600); // 1 hour TTL
    }

    res.json({ success: true, data, cached: false });
});

/**
 * POST /api/v1/disease-info/seed-advice
 * Body: { farmInfo, language }
 */
export const fetchSeedAndYieldAdvice = asyncHandler(async (req, res) => {
    const { farmInfo, language = "en" } = req.body;

    if (!farmInfo) {
        res.status(400);
        throw new Error("farmInfo is required.");
    }

    // Auto-populate address from user profile if missing
    if (!farmInfo.address) {
        const user = await User.findById(req.user._id).lean();
        farmInfo.address = user?.address;
    }

    const user = await User.findById(req.user._id).lean();
    const advice = await getSeedAndYieldAdvice(farmInfo, language, user?.groqApiKey);
    res.json({ success: true, advice });
});
