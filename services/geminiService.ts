import * as tf from '@tensorflow/tfjs';
import * as nsfwjs from 'nsfwjs';
import { DetectionResult, Prediction } from "../types";

// Singleton to hold the loaded model
let model: nsfwjs.NSFWJS | null = null;
let isModelLoading = false;

export const loadModel = async (): Promise<boolean> => {
  if (model) return true;
  if (isModelLoading) return false;

  try {
    isModelLoading = true;
    console.log("Loading NSFWJS model...");
    
    // Explicitly using the hosted URL for MobileNetV2 to avoid ESM relative path issues.
    // We also await tf.ready() to ensure the backend (WebGL) is initialized.
    await tf.ready();
    
    // Sometimes the default export needs to be handled for certain bundlers/CDN
    // @ts-ignore
    const loadFn = nsfwjs.load || nsfwjs.default?.load || nsfwjs.default;

    if (typeof loadFn === 'function') {
         model = await loadFn('https://models.infinitered.io/saved_model_mobilenet_v2/');
    } else {
         // Fallback if import structure is standard
         model = await nsfwjs.load('https://models.infinitered.io/saved_model_mobilenet_v2/');
    }

    console.log("NSFWJS model loaded successfully");
    return true;
  } catch (err) {
    console.error("Failed to load NSFWJS model", err);
    return false;
  } finally {
    isModelLoading = false;
  }
};

/**
 * Analyzes a video element directly using the local TensorFlow model.
 * Returns classification probabilities.
 */
export const detectSensitiveContent = async (videoElement: HTMLVideoElement): Promise<DetectionResult> => {
  if (!model) {
    // Attempt to load if not loaded, but return safe for this frame
    await loadModel();
    return { isSafe: true, predictions: [], primaryCategory: 'Loading' };
  }

  try {
    // classify expects an image, video, or canvas
    const predictions = await model.classify(videoElement);
    
    // Check for unsafe content
    // Categories: 'Neutral', 'Drawing', 'Hentai', 'Porn', 'Sexy'
    // We strictly filter 'Porn' and 'Hentai'. 'Sexy' can be optional based on strictness.
    
    const unsafeThreshold = 0.55; // 55% confidence
    const unsafeCategories = ['Porn', 'Hentai'];
    
    // Find the top prediction
    const topPrediction = predictions[0];
    
    const isUnsafe = unsafeCategories.includes(topPrediction.className) && 
                     topPrediction.probability > unsafeThreshold;

    return {
      isSafe: !isUnsafe,
      predictions: predictions as Prediction[],
      primaryCategory: topPrediction.className
    };

  } catch (error) {
    console.error("NSFWJS detection error:", error);
    return { isSafe: true, predictions: [], primaryCategory: 'Error' };
  }
};