import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

/**
 * AI service - supports both Gemini (preferred) and Groq (backup).
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
 * Identifies the crop and checks relevance using Groq's Llama 3.2 Vision capabilities.
 */
export const identifyCropWithAI = async (fileBuffer, mimeType) => {
  const base64Image = fileBuffer.toString("base64");

  // --- 1. Try Gemini (Preferred for Vision) ---
  const gemini = createGeminiClient();
  if (gemini) {
    try {
      console.log("[AI] Attempting identification with Gemini 1.5 Flash Latest...");
      const model = gemini.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
      const prompt = `
        Analyze this agricultural image. 
        Note: Ignore any human hands, fingers, or background objects. Focus ONLY on the plant leaf, fruit, or stalk.
        
        1. Is this a plant, crop, or leaf? (relevant: true/false)
        2. Identify the crop from this list: [Banana, Chilli, Radish, Groundnut, Cauliflower, Apple, Blueberry, Cherry, Corn, Grape, Orange, Peach, Pepper, Potato, Raspberry, Soybean, Squash, Strawberry, Tomato].
        
        If it is a plant but not in the list, return 'Other'.
        Return ONLY a JSON object:
        {
          "relevant": true,
          "detectedCrop": "Corn", 
          "confidence": 98.5,
          "explanation": "Brief reasoning"
        }
      `;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Image, mimeType: mimeType || "image/jpeg" } }
      ]);
      const resText = result.response.text();
      const jsonStr = resText.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(jsonStr);
    } catch (err) {
      console.warn("[AI] Gemini identification failed, trying Groq fallback...", err.message);
    }
  }

  // --- 2. Try Groq (Backup) ---
  const groq = createGroqClient();
  if (groq) {
    try {
      console.log("[AI] Attempting identification with Groq Llama 3.2...");
      const prompt = `Return JSON only: { "relevant": boolean, "detectedCrop": "Banana/Chilli/etc", "confidence": 0-100 }. Is this a plant? Image list: [Banana, Chilli, Radish, Groundnut, Cauliflower, Apple, Blueberry, Cherry, Corn, Grape, Orange, Peach, Pepper, Potato, Raspberry, Soybean, Squash, Strawberry, Tomato]`;

      const response = await groq.chat.completions.create({
        model: "llama-3.2-11b-vision-preview",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType || "image/jpeg"};base64,${base64Image}` } }
          ]
        }],
        response_format: { type: "json_object" }
      });
      return JSON.parse(response.choices[0].message.content);
    } catch (err) {
      console.error("[AI] Groq identification failed:", err.message);
    }
  }

  throw new Error("All AI identification providers failed.");
};

/**
 * Analyzes crop disease using the best available Vision LLM (Gemini preferred).
 * Especially useful for crops not in our training set (like Corn).
 */
export const analyzeCropDisease = async (images, cropInfo, language) => {
  const targetLanguage = language === "mr" ? "Marathi" : "English";
  const prompt = `
    You are an expert agronomist. Analyze these images of a ${cropInfo.cropName} plant.
    Diagnosis must be in ${targetLanguage}. Return JSON ONLY:
    {
      "detectedDisease": "Disease Name",
      "diagnosis": "Explanation in ${targetLanguage}",
      "recommendation": "Step-by-step treatment in ${targetLanguage}"
    }
  `;

  // --- 1. Try Gemini (Flash) ---
  const gemini = createGeminiClient();
  if (gemini) {
    try {
      console.log("[AI] Analyzing disease with Gemini 1.5 Flash Latest...");
      const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      const imageParts = await Promise.all(images.map(async (file) => {
        const buffer = fs.readFileSync(file.path);
        return { inlineData: { data: buffer.toString("base64"), mimeType: "image/jpeg" } };
      }));
      const result = await model.generateContent([prompt, ...imageParts]);
      return JSON.parse(result.response.text().replace(/```json/g, "").replace(/```/g, "").trim());
    } catch (err) {
      console.warn("[AI] Gemini analysis fallback to Groq...", err.message);
    }
  }

  // --- 2. Try Groq (Llama Vision) ---
  const groq = createGroqClient();
  if (groq) {
    try {
      console.log("[AI] Analyzing disease with Groq Llama 3.2...");
      const content = [{ type: "text", text: prompt }];
      for (const file of images) {
        const imgBuffer = fs.readFileSync(file.path);
        content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${imgBuffer.toString("base64")}` } });
      }
      const response = await groq.chat.completions.create({
        model: "llama-3.2-11b-vision-preview",
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" }
      });
      return JSON.parse(response.choices[0].message.content);
    } catch (err) {
      console.error("[AI] Groq analysis failed:", err.message);
    }
  }

  throw new Error("Analysis failed - No AI provider available.");
};
