import { GoogleGenAI, Type } from "@google/genai";
import { DetectionResult } from "../types";

// Initialize Gemini Client
// Note: process.env.API_KEY is guaranteed by the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Sends a base64 image to Gemini to detect specific areas that need privacy masking (NSFW).
 * We ask specifically for bounding boxes of exposed skin or inappropriate content.
 */
export const detectSensitiveContent = async (base64Image: string): Promise<DetectionResult> => {
  try {
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: `Analyze this video frame for inappropriate content such as nudity, exposed private areas, or very revealing clothing suitable for NSFW filtering.
            
            Return a JSON object containing a list of bounding boxes for these areas.
            Coordinates (ymin, xmin, ymax, xmax) must be normalized between 0 and 1.
            If the image is safe, return an empty list.
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  ymin: { type: Type.NUMBER },
                  xmin: { type: Type.NUMBER },
                  ymax: { type: Type.NUMBER },
                  xmax: { type: Type.NUMBER },
                  label: { type: Type.STRING },
                  confidence: { type: Type.NUMBER }
                },
                required: ["ymin", "xmin", "ymax", "xmax"]
              }
            }
          },
          required: ["detections"]
        }
      }
    });

    const text = response.text;
    if (!text) return { detections: [] };

    const result = JSON.parse(text) as DetectionResult;
    return result;

  } catch (error) {
    console.error("Gemini detection error:", error);
    return { detections: [] };
  }
};