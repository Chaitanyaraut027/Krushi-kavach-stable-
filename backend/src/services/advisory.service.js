import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { getWeatherData } from "./weather.service.js";
import Crop from "../models/crop.model.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * AI service - generates advisories using Gemini 2.5 Flash with Groq fallback.
 */
const createGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
};

const createGroqClient = () => {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
};

/**
 * Generates AI-powered weather advisories for a user's crops.
 */
export const generateAdvisories = async (user) => {
  try {
    const [lon, lat] = user.location.coordinates;
    const userCrops = await Crop.find({ farmer: user._id });

    if (userCrops.length === 0) return [];

    const weatherData = await getWeatherData(lat, lon);
    const cropNames = userCrops.map((c) => c.cropName);
    const weatherForecastString = JSON.stringify(weatherData.daily, null, 2);

    const prompt = `
      You are an expert agronomist for Indian agriculture. 
      Analyze the provided 7-day weather forecast for a farmer in Maharashtra growing these crops: ${cropNames.join(", ")}.

      Forecast Data: ${weatherForecastString}

      Identify potential threats (disease, pests, waterlogging, heat stress, etc.) for each crop.
      Return a JSON array of objects with this structure:
      [
        {
          "cropName": "string",
          "threatLevel": "Low" | "Medium" | "High",
          "threat": "string",
          "recommendation": "string",
          "impactDay": "YYYY-MM-DD"
        }
      ]
    `;

    // 1. Try Gemini first
    const gemini = createGeminiClient();
    if (gemini) {
      try {
        const model = gemini.getGenerativeModel({
          model: "gemini-2.5-flash",
          generationConfig: { responseMimeType: "application/json" }
        });
        const res = await model.generateContent(prompt);
        const text = res.response.text();
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : Object.values(parsed)[0];
      } catch (geminiErr) {
        console.warn("[AI Advisory] Gemini failed, attempting Groq fallback:", geminiErr.message);
      }
    }

    // 2. Groq fallback
    const groq = createGroqClient();
    if (groq) {
      const modelsToTry = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b", "llama-3.3-70b-versatile"];
      for (const m of modelsToTry) {
        try {
          const response = await groq.chat.completions.create({
            model: m,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            response_format: { type: "json_object" }
          });
          const content = response.choices[0].message.content;
          const advisories = JSON.parse(content);
          return Array.isArray(advisories) ? advisories : Object.values(advisories)[0];
        } catch (groqErr) {
          console.warn(`[AI Advisory] Groq model ${m} failed:`, groqErr.message);
        }
      }
    }

    throw new Error("No AI service available for advisories.");
  } catch (error) {
    console.error("Error generating AI advisory:", error.message);
    return [
      {
        cropName: "System Alert",
        threatLevel: "Medium",
        threat: "Could not generate AI advisory at this time.",
        recommendation: "Please try again later.",
        impactDay: new Date().toISOString().split("T")[0],
      },
    ];
  }
};
