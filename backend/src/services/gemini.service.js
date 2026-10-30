/**
 * AI service — uses Google Gemini 2.5 Flash as primary with Groq API as resilient backup.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

const LANGUAGE_NAMES = {
  en: "English",
  hi: "Hindi (हिंदी)",
  mr: "Marathi (मराठी)",
  hinglish: "Hinglish (Hindi written in English script with a mix of English words)",
};

const createGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
};

const createClient = (userApiKey = null) => {
  const apiKey = userApiKey || process.env.GROK_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
};

const stripFences = (text) =>
  text.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");

/**
 * Robustly parse a JSON string coming from an LLM.
 */
const DEVANAGARI_DIGIT_MAP = {
  '\u0966': '0', '\u0967': '1', '\u0968': '2', '\u0969': '3', '\u096a': '4',
  '\u096b': '5', '\u096c': '6', '\u096d': '7', '\u096e': '8', '\u096f': '9',
  '\u0ae6': '0', '\u0ae7': '1', '\u0ae8': '2', '\u0ae9': '3', '\u0aea': '4',
  '\u0aeb': '5', '\u0aec': '6', '\u0aed': '7', '\u0aee': '8', '\u0aef': '9',
  '\u09e6': '0', '\u09e7': '1', '\u09e8': '2', '\u09e9': '3', '\u09ea': '4',
  '\u09eb': '5', '\u09ec': '6', '\u09ed': '7', '\u09ee': '8', '\u09ef': '9',
  '\u0660': '0', '\u0661': '1', '\u0662': '2', '\u0663': '3', '\u0664': '4',
  '\u0665': '5', '\u0666': '6', '\u0667': '7', '\u0668': '8', '\u0669': '9',
};

const normalizeAndParseJSON = (raw) => {
  let text = stripFences(raw);
  text = text.replace(/[\u0966-\u096f\u0ae6-\u0aef\u09e6-\u09ef\u0660-\u0669]/g,
    (ch) => DEVANAGARI_DIGIT_MAP[ch] || ch);

  try {
    return JSON.parse(text);
  } catch (_) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error(`Unable to parse JSON from LLM response: ${text.slice(0, 200)}`);
  }
};

/**
 * Universal resilient completion helper.
 * 1. Tries Google Gemini 2.5 Flash
 * 2. Falls back to Groq with working models (openai/gpt-oss-120b, openai/gpt-oss-20b, qwen/qwen3.8-27b)
 */
export const generateAICompletion = async ({
  prompt,
  systemPrompt = "",
  jsonMode = false,
  temperature = 0.3,
  maxTokens = 8192,
  userApiKey = null,
}) => {
  // Always allow ample output tokens for Gemini (minimum 8192) so it never truncates JSON
  const effectiveMaxTokens = Math.max(maxTokens || 0, 8192);

  // 1. Try Gemini 2.5 Flash
  const gemini = createGeminiClient();
  if (gemini) {
    try {
      const model = gemini.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          temperature,
          maxOutputTokens: effectiveMaxTokens,
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        },
        ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
      });
      const res = await model.generateContent(prompt);
      const text = res.response.text();
      return jsonMode ? normalizeAndParseJSON(text) : text;
    } catch (err) {
      console.warn("[AI] Gemini 2.5 Flash call failed, falling back to Groq:", err.message);
    }
  }

  // 2. Groq fallback with multi-key resiliency
  const keysToTry = [];
  if (userApiKey && userApiKey.trim() && userApiKey.startsWith("gsk_")) {
    keysToTry.push(userApiKey.trim());
  }
  if (process.env.GROK_API_KEY && !keysToTry.includes(process.env.GROK_API_KEY)) {
    keysToTry.push(process.env.GROK_API_KEY);
  }

  const modelsToTry = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b", "llama-3.3-70b-versatile"];

  for (const apiKey of keysToTry) {
    try {
      const groq = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
      for (const model of modelsToTry) {
        try {
          const messages = [];
          if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
          messages.push({ role: "user", content: prompt });
          const res = await groq.chat.completions.create({
            model,
            messages,
            temperature,
            max_tokens: 3000,
            ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
          });
          const content = res.choices[0].message.content;
          return jsonMode ? normalizeAndParseJSON(content) : content;
        } catch (err) {
          console.warn(`[AI] Groq model ${model} failed with key ${apiKey.slice(0, 10)}...:`, err.message);
        }
      }
    } catch (clientErr) {
      console.warn("[AI] Groq client creation error:", clientErr.message);
    }
  }

  throw new Error("No AI service available or all models failed.");
};

// ─────────────────────────────────────────────────────────────────────────────
//  KRISHI KAVACH PROJECT KNOWLEDGE BASE
// ─────────────────────────────────────────────────────────────────────────────
const PROJECT_KNOWLEDGE = `
# Krishi Kavach — Complete Project Knowledge Base
## What is Krishi Kavach?
Krishi Kavach is an agricultural advisory platform for Indian farmers.
It helps farmers detect crop diseases using AI, check weather forecasts, connect with local agronomists, manage crops, and receive farming guidance in English, Hindi, and Marathi.
`;

// ─────────────────────────────────────────────────────────────────────────────
//  1. STRUCTURED DISEASE / CARE INFO
// ─────────────────────────────────────────────────────────────────────────────
export const getCropDiseaseInfo = async (cropName, diseaseName, language = "en", userApiKey = null) => {
  const langName = LANGUAGE_NAMES[language] || "English";
  const isHealthy = diseaseName?.toLowerCase().includes("healthy");

  const prompt = isHealthy
    ? `You are an expert agricultural advisor for Indian farmers.
The AI model detected that the ${cropName} plant appears HEALTHY.
Provide comprehensive care tips for the farmer in ${langName}.
Return ONLY a valid JSON object:
{
  "title": "short heading in ${langName}",
  "summary": "2-3 sentence overview in ${langName}",
  "symptoms": [],
  "causes": [],
  "whyCausesDisease": [],
  "treatment": ["care tip 1", "care tip 2", "care tip 3"],
  "prevention": ["preventive measure 1", "preventive measure 2", "preventive measure 3"],
  "severity": "None",
  "naturalRemedies": ["natural care tip 1", "natural care tip 2"],
  "yieldImpact": "Brief note on why current health will maximize yield in ${langName}",
  "yieldRecoveryTips": ["tip to further boost yield in ${langName}"]
}
All text values must be in ${langName}. Use ASCII digits.`
    : `You are a senior agricultural plant pathologist and advisor for Indian farmers.
A crop disease AI model detected "${diseaseName}" in a "${cropName}" plant.
Provide comprehensive, practical, farmer-friendly information in ${langName}.
Return ONLY a valid JSON object:
{
  "title": "Disease name in ${langName}",
  "summary": "2-3 sentence overview in ${langName}",
  "symptoms": ["Symptom 1 in ${langName}", "Symptom 2 in ${langName}", "Symptom 3 in ${langName}"],
  "causes": ["Cause 1 in ${langName}", "Cause 2 in ${langName}"],
  "whyCausesDisease": ["Why it occurs 1 in ${langName}", "Why it spreads 2 in ${langName}"],
  "treatment": ["Treatment step 1 with product names in ${langName}", "Treatment step 2 in ${langName}", "Treatment step 3 in ${langName}"],
  "prevention": ["Prevention 1 in ${langName}", "Prevention 2 in ${langName}"],
  "severity": "Medium",
  "naturalRemedies": ["Organic remedy 1 in ${langName}", "Organic remedy 2 in ${langName}"],
  "yieldImpact": "Specific description of crop loss if untreated in ${langName}",
  "yieldRecoveryTips": ["Tip to recover yield 1 in ${langName}", "Tip 2 in ${langName}"]
}
For severity choose one of: "Low", "Medium", "High". All text in ${langName}. Use ASCII digits.`;

  return generateAICompletion({
    prompt,
    jsonMode: true,
    temperature: 0.3,
    maxTokens: 2500,
    userApiKey,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
//  2. GLOBAL CHATBOT
// ─────────────────────────────────────────────────────────────────────────────
export const chatWithAI = async (messages, pageContext = "", language = "en", userApiKey = null) => {
  const langName = LANGUAGE_NAMES[language] || "English";
  const systemPrompt = `You are **Krishi Kavach AI Assistant** — a friendly agricultural advisor for Indian farmers.
${PROJECT_KNOWLEDGE}
User context: ${pageContext || "Navigating platform"}
Rules:
1. Always respond in ${langName}. Use simple language suitable for rural farmers.
2. Only answer agricultural, crop disease, farming, weather, and Krishi Kavach questions.
3. Be helpful, practical, encouraging and respectful.`;

  // 1. Try Gemini
  const gemini = createGeminiClient();
  if (gemini) {
    try {
      const model = gemini.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: systemPrompt,
        generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
      });
      const formattedHistory = messages.slice(0, -1).map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const chat = model.startChat({ history: formattedHistory });
      const lastMsg = messages[messages.length - 1]?.content || "Hello";
      const result = await chat.sendMessage(lastMsg);
      return result.response.text().trim();
    } catch (err) {
      console.warn("[AI Chat] Gemini failed, trying Groq fallback:", err.message);
    }
  }

  // 2. Groq fallback
  const groq = createClient(userApiKey);
  if (groq) {
    const modelsToTry = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b", "llama-3.3-70b-versatile"];
    for (const model of modelsToTry) {
      try {
        const response = await groq.chat.completions.create({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          temperature: 0.4,
          max_tokens: 1200,
        });
        return response.choices[0].message.content.trim();
      } catch (err) {
        console.warn(`[AI Chat] Groq model ${model} failed:`, err.message);
      }
    }
  }

  throw new Error("Chatbot AI service currently unavailable.");
};

// ─────────────────────────────────────────────────────────────────────────────
//  3. CROP MANAGEMENT GUIDANCE
// ─────────────────────────────────────────────────────────────────────────────
export const getCropManagementInfo = async (cropName, area, areaUnit, language = "en", userApiKey = null) => {
  const langName = LANGUAGE_NAMES[language] || "English";

  const prompt = `You are an expert agronomist advising an Indian farmer growing "${cropName}" on ${area} ${areaUnit} of land.
Provide comprehensive, end-to-end guidance in ${langName}.
Return ONLY a valid JSON object:
{
  "cropName": "${cropName}",
  "area": "${area} ${areaUnit}",
  "overview": "2-3 sentences overview in ${langName}",
  "sowingMonths": "Best months for sowing in ${langName}",
  "harvestMonths": "Expected harvest months in ${langName}",
  "suitableSoil": "Best soil type in ${langName}",
  "seedRequirement": "Exact seed quantity for ${area} ${areaUnit} in ${langName}",
  "landPreparation": ["Step 1 in ${langName}", "Step 2", "Step 3"],
  "sowingMethod": "Recommended method in ${langName}",
  "spacing": "Row-to-row and plant-to-plant spacing in ${langName}",
  "irrigationSchedule": [
    { "stage": "Stage name in ${langName}", "timing": "When in ${langName}", "method": "How much/method in ${langName}", "critical": true }
  ],
  "fertilizerSchedule": [
    { "stage": "Stage in ${langName}", "timing": "When in ${langName}", "fertilizer": "Fertilizer name in ${langName}", "dose": "Quantity for ${area} ${areaUnit} in ${langName}", "application": "How to apply in ${langName}" }
  ],
  "interculturalOperations": ["Weeding/earthing up in ${langName}"],
  "commonPestsAndDiseases": [
    { "name": "Pest/disease name in ${langName}", "symptoms": "Key sign in ${langName}", "control": "Treatment in ${langName}" }
  ],
  "harvest": {
    "duration": "Days to harvest in ${langName}",
    "signs": "Readiness signs in ${langName}",
    "method": "How to harvest in ${langName}",
    "expectedYield": "Expected yield for ${area} ${areaUnit} in ${langName}"
  },
  "estimatedCost": "Estimated total cost in INR in ${langName}",
  "estimatedProfit": "Estimated profit in INR in ${langName}",
  "tips": ["Tip 1 in ${langName}", "Tip 2", "Tip 3"],
  "commonMistakes": ["Mistake to avoid 1 in ${langName}", "Mistake 2"],
  "durationDays": 120
}
All text values in ${langName}. Use ASCII digits only.`;

  return generateAICompletion({
    prompt,
    jsonMode: true,
    temperature: 0.3,
    maxTokens: 2500,
    userApiKey,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
//  4. WEATHER CROP IMPACT ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────
export const getWeatherCropImpact = async (cropName, currentWeather, dailyForecast, language = "en", userApiKey = null) => {
  const langName = LANGUAGE_NAMES[language] || "English";

  const weatherSummary = `Temp=${currentWeather.temperature}°C, Humidity=${currentWeather.humidity}%, Wind=${currentWeather.windSpeed}km/h, Rain=${currentWeather.precipitation}mm`;
  const forecastSummary = dailyForecast.slice(0, 7)
    .map((d, i) => `Day${i + 1}: Max=${d.maxTemp}°C Min=${d.minTemp}°C Rain=${d.precipitation}mm`)
    .join(" | ");

  const prompt = `Analyze weather data for "${cropName}" cultivation in India:
${weatherSummary}
Forecast: ${forecastSummary}
Respond in ${langName} as JSON:
{
  "cropName": "${cropName}",
  "overallRisk": "Low" | "Medium" | "High",
  "summary": "2-sentence summary in ${langName}",
  "temperatureImpact": { "risk": "Low"|"Medium"|"High", "details": "in ${langName}", "action": "in ${langName}" },
  "rainfallImpact": { "risk": "Low"|"Medium"|"High", "details": "in ${langName}", "action": "in ${langName}" },
  "humidityImpact": { "risk": "Low"|"Medium"|"High", "details": "in ${langName}", "action": "in ${langName}" },
  "pestDiseaseAlert": { "alert": true, "potentialIssues": ["Issue 1 in ${langName}"], "preventiveAction": "in ${langName}" },
  "immediateActions": ["Action 1 in ${langName}", "Action 2 in ${langName}"],
  "sprayingAdvice": { "suitable": true, "bestTime": "in ${langName}", "reason": "in ${langName}" },
  "irrigationAdvice": { "needed": false, "reason": "in ${langName}" }
}
All text in ${langName}. ASCII numbers only.`;

  return generateAICompletion({
    prompt,
    jsonMode: true,
    temperature: 0.3,
    maxTokens: 2500,
    userApiKey,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
//  5. MARKET PRICES
// ─────────────────────────────────────────────────────────────────────────────
export const getMarketPrices = async (commodity, district = "Nashik", state = "Maharashtra", userApiKey = null) => {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const prompt = `Provide realistic commodity price intelligence for "${commodity}" in ${district}, ${state} (India).
Date: ${todayStr}
Return JSON:
{
  "commodity": "${commodity}",
  "unit": "quintal",
  "district": "${district}",
  "state": "${state}",
  "summary": "1-2 sentence overview in English",
  "trend": "rising"|"stable"|"falling",
  "trendPercent": 2.5,
  "localMarkets": [
    { "marketName": "Main APMC in ${district}", "district": "${district}", "distance": "0 km", "minPrice": 4200, "maxPrice": 4800, "modalPrice": 4500, "arrivalQty": "1200 quintals", "quality": "A" }
  ],
  "majorMarkets": [
    { "marketName": "Top market 1", "city": "City", "state": "State", "modalPrice": 4600, "trend": "rising", "note": "High demand" }
  ],
  "priceHistory": [
    { "date": "${todayStr}", "price": 4500 }
  ],
  "seasonalInsight": "Insight",
  "bestTimeToSell": "Advice",
  "mspInfo": "MSP info"
}`;

  const data = await generateAICompletion({
    prompt,
    jsonMode: true,
    temperature: 0.4,
    maxTokens: 2500,
    userApiKey,
  });

  if (Array.isArray(data.priceHistory)) {
    data.priceHistory = data.priceHistory.slice(0, 30).map((row, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (29 - i));
      return { date: d.toISOString().slice(0, 10), price: row.price || row.modalPrice || 4000 };
    });
  }

  return data;
};

// ─────────────────────────────────────────────────────────────────────────────
//  6. SEED & YIELD ADVICE
// ─────────────────────────────────────────────────────────────────────────────
export const getSeedAndYieldAdvice = async (farmInfo, language = "en", userApiKey = null) => {
  const langName = LANGUAGE_NAMES[language] || "English";

  const prompt = `Agricultural consultant context:
Crop: ${farmInfo.primaryCrops?.join(", ")}
Area: ${farmInfo.totalArea?.value} ${farmInfo.totalArea?.unit}
Soil: ${farmInfo.soilType}
Irrigation: ${farmInfo.irrigationType}
Location: ${farmInfo.address?.taluka}, ${farmInfo.address?.district}
Stage: ${farmInfo.farmingStage}
Return JSON:
{
  "seedRecommendations": [
    { "name": "Variety Name", "features": "Why it fits in ${langName}", "duration": "Days", "yieldPotential": "Potential", "storeType": "Store", "searchQuery": "Search" }
  ],
  "yieldAnalysis": {
    "estimatedYield": "Estimated yield in ${langName}",
    "benchmarks": "District benchmark in ${langName}",
    "optimizationTips": ["Tip 1 in ${langName}"]
  },
  "marketContext": "Demand in ${langName}"
}
All text in ${langName}. ASCII numbers.`;

  return generateAICompletion({
    prompt,
    jsonMode: true,
    temperature: 0.4,
    maxTokens: 2000,
    userApiKey,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
//  7. GOVERNMENT SCHEMES RECOMMENDATION
// ─────────────────────────────────────────────────────────────────────────────
export const getRecommendedSchemes = async (user, language = "en", userApiKey = null) => {
  const langName = LANGUAGE_NAMES[language] || "English";

  const prompt = `Recommend 5 real Indian agricultural schemes for farmer ${user.fullName} in ${user.address?.district}, ${user.address?.state || "Maharashtra"}.
Return JSON:
{
  "recommendations": [
    {
      "id": "scheme-slug",
      "title": "Scheme Name in ${langName}",
      "shortDescription": "1-sentence description in ${langName}",
      "benefits": ["Benefit 1 in ${langName}"],
      "eligibility": "Eligibility in ${langName}",
      "documentsRequired": ["Aadhaar", "Land Records"],
      "applicationSteps": ["Step 1 in ${langName}"],
      "lastDate": "31 March 2026",
      "websiteUrl": "https://pmkisan.gov.in",
      "officialPortal": "https://agricoop.nic.in",
      "imageKeywords": "indian agriculture farmer",
      "tags": ["Subsidy"],
      "relevanceReason": "Why suitable in ${langName}"
    }
  ],
  "summary": "Short encouraging summary in ${langName}"
}
All text in ${langName}. ASCII numbers.`;

  return generateAICompletion({
    prompt,
    jsonMode: true,
    temperature: 0.5,
    maxTokens: 2500,
    userApiKey,
  });
};
