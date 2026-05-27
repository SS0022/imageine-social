import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

export interface ApiKeyConfig {
  key: string;
  shared: boolean;
}

export interface ApiKeyStatus extends ApiKeyConfig {
  status: "Active" | "Exhausted";
  nextAvailable: number | null;
  requestsCount: number;
  lastError?: string;
}

let apiKeys: ApiKeyStatus[] = [];

// Initialize with platform keys if available
const getPlatformKeys = () => [process.env.GEMINI_API_KEY, process.env.API_KEY].filter(Boolean) as string[];

apiKeys = Array.from(new Set(getPlatformKeys())).map(key => ({
  key,
  shared: false,
  status: "Active",
  nextAvailable: null,
  requestsCount: 0
}));

export const setGeminiApiKeys = (keys: (string | ApiKeyConfig)[]) => {
  const platformKeys = getPlatformKeys();
  
  const normalizedKeys: ApiKeyConfig[] = keys.map(k => {
    if (typeof k === "string") return { key: k, shared: false };
    return k;
  }).filter(k => k.key.trim() !== "");
  
  // Ensure platform keys are included. 
  platformKeys.forEach(pk => {
    if (!normalizedKeys.find(nk => nk.key === pk)) {
      normalizedKeys.unshift({ key: pk, shared: false });
    }
  });

  apiKeys = normalizedKeys.map(config => {
    const existing = apiKeys.find(a => a.key === config.key);
    return {
      ...config,
      status: existing?.status || "Active",
      nextAvailable: existing?.nextAvailable || null,
      requestsCount: existing?.requestsCount || 0,
      lastError: existing?.lastError
    };
  });
};

export const getApiKeysStatus = (): ApiKeyStatus[] => {
  const now = Date.now();
  return apiKeys.map(a => {
    if (a.status === "Exhausted" && a.nextAvailable && a.nextAvailable <= now) {
      return { ...a, status: "Active", nextAvailable: null };
    }
    return a;
  });
};

const callWithRetry = async (fn: (ai: any) => Promise<any>) => {
  let lastError: any;
  
  // We want to try every key exactly once if needed
  const initialKeys = getApiKeysStatus();
  const keyCount = initialKeys.length;
  
  // Keep track of keys we've already tried in this specific operation
  const triedKeys = new Set<string>();

  for (let attempt = 0; attempt < keyCount; attempt++) {
    const currentStatus = getApiKeysStatus();
    
    // Find the first active key we haven't tried yet
    const keyInfo = currentStatus.find(k => k.status === "Active" && !triedKeys.has(k.key));
    
    if (!keyInfo) {
      // No more active keys to try
      break;
    }

    triedKeys.add(keyInfo.key);
    const aiInstance = { ai: new GoogleGenAI({ apiKey: keyInfo.key }), key: keyInfo.key };

    try {
      const result = await fn(aiInstance.ai);
      
      // Update success count
      const keyObj = apiKeys.find(a => a.key === aiInstance.key);
      if (keyObj) {
        keyObj.requestsCount++;
        keyObj.status = "Active";
        keyObj.lastError = undefined;
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      let errorMsg = error.message || "";
      let isQuotaError = errorMsg.includes("429") || 
                         errorMsg.includes("quota") || 
                         errorMsg.includes("exhausted") ||
                         error.status === 429;

      let delayMs = 60000;
      try {
        const jsonMatch = errorMsg.match(/\{.*\}/s);
        if (jsonMatch) {
          const detail = JSON.parse(jsonMatch[0]);
          if (detail.error?.status === "RESOURCE_EXHAUSTED" || detail.status === "RESOURCE_EXHAUSTED") {
            isQuotaError = true;
            const retryInfo = detail.error?.details?.find((d: any) => d["@type"]?.includes("RetryInfo")) || 
                             detail.details?.find((d: any) => d["@type"]?.includes("RetryInfo"));
            if (retryInfo?.retryDelay) {
              const seconds = parseInt(retryInfo.retryDelay.replace("s", ""));
              if (!isNaN(seconds)) delayMs = (seconds + 5) * 1000;
            }
          }
        }
      } catch (e) {}

      if (isQuotaError) {
        const keyToUpdate = apiKeys.find(a => a.key === aiInstance.key);
        if (keyToUpdate) {
          keyToUpdate.status = "Exhausted";
          keyToUpdate.nextAvailable = Date.now() + delayMs;
          keyToUpdate.lastError = "Quota Exhausted";
        }
        console.warn(`API Key ${aiInstance.key.substring(0, 4)}... exhausted, trying next...`);
        continue;
      }
      
      const keyToUpdate = apiKeys.find(a => a.key === aiInstance.key);
      if (keyToUpdate) {
        keyToUpdate.lastError = errorMsg.substring(0, 100);
      }
      console.error(`API Key ${aiInstance.key.substring(0, 4)}... failed:`, errorMsg);
    }
  }

  // If we get here, either all keys are exhausted or all attempts failed
  if (lastError) throw lastError;
  
  // Just in case no keys were tried
  throw new Error("No active API keys available to fulfill the request.");
};

export interface GeneratedPost {
  platform: string;
  content: string;
  suggestedHashtags: string[];
  imageData?: string | string[] | null;
  imageType?: "Single" | "Carousel";
  imageStyle?: string;
  carouselCount?: number;
  id?: number;
  publishedUrl?: string | null;
}

const cleanJson = (text: string) => {
  return text.replace(/```json\n?|```/g, "").trim();
};

export const generateSocialPosts = async (idea: string, tone: string, platforms: string[], brandGuidelines?: string, brandWebsite?: string) => {
  let prompt = `
    Transform the following idea into social media posts for ${platforms.join(", ")}.
    Tone: ${tone}
    Idea: ${idea}
  `;

  if (brandGuidelines) {
    prompt += `\n\nFollow these brand guidelines: ${brandGuidelines}`;
  }

  if (brandWebsite) {
    prompt += `\n\nBrand Website for context: ${brandWebsite}`;
  }

  prompt += `
    \nFor each platform, provide the post content and a list of suggested hashtags.
    Return the result as a JSON array of objects.
  `;

  return await callWithRetry(async (ai) => {
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              platform: { type: Type.STRING },
              content: { type: Type.STRING },
              suggestedHashtags: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["platform", "content", "suggestedHashtags"]
          }
        }
      }
    });
    
    const text = typeof result.text === 'function' ? result.text() : (result.response?.text?.() || result.text || "");
    return JSON.parse(cleanJson(text)) as GeneratedPost[];
  });
};

export const getCelebrations = async () => {
  const prompt = "List upcoming major Indian and USA celebrations, festivals, and important days for the next 60 days. Include the name, country (India or USA), date (YYYY-MM-DD), and a brief description.";
  
  return await callWithRetry(async (ai) => {
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              country: { type: Type.STRING },
              date: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ["name", "country", "date", "description"]
          }
        }
      }
    });
    const text = typeof result.text === 'function' ? result.text() : (result.response?.text?.() || result.text || "");
    return JSON.parse(cleanJson(text));
  });
};

export const generateSingleSocialPost = async (platform: string, idea: string, tone: string, brandGuidelines?: string, brandWebsite?: string) => {
  let prompt = `
    Regenerate the social media post content for ${platform}.
    Tone: ${tone}
    Idea: ${idea}
  `;

  if (brandGuidelines) {
    prompt += `\n\nFollow these brand guidelines: ${brandGuidelines}`;
  }

  if (brandWebsite) {
    prompt += `\n\nBrand Website for context: ${brandWebsite}`;
  }

  prompt += `
    \nProvide the post content and a list of suggested hashtags.
    Return the result as a JSON object.
  `;

  return await callWithRetry(async (ai) => {
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            platform: { type: Type.STRING },
            content: { type: Type.STRING },
            suggestedHashtags: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["platform", "content", "suggestedHashtags"]
        }
      }
    });
    const text = typeof result.text === 'function' ? result.text() : (result.response?.text?.() || result.text || "");
    return JSON.parse(cleanJson(text)) as GeneratedPost;
  });
};

// Helper functions for logo overlay
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error("Failed to load image: " + e));
    img.src = src;
  });
};

const getBrightness = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  try {
    const imageData = ctx.getImageData(
      Math.max(0, Math.floor(x)), 
      Math.max(0, Math.floor(y)), 
      Math.min(Math.floor(w), ctx.canvas.width - Math.floor(x)), 
      Math.min(Math.floor(h), ctx.canvas.height - Math.floor(y))
    );
    const data = imageData.data;
    let colorSum = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const avg = (r + g + b) / 3;
      colorSum += avg;
    }

    return colorSum / (data.length / 4);
  } catch (e) {
    return 128; // Default to neutral
  }
};

type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const determineLogoPlacement = async (base64Image: string): Promise<LogoPosition> => {
  try {
    const prompt = "Analyze this image and determine the best corner to place a brand logo. Choose the corner that is least busy and provides the best contrast for visibility. Return ONLY one of these strings: 'top-left', 'top-right', 'bottom-left', 'bottom-right'.";
    
    return await callWithRetry(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: base64Image.split(',')[1],
                  mimeType: "image/png"
                }
              }
            ]
          }
        ]
      });
      
      const result = response.text?.toLowerCase().trim() || "";
      if (result.includes('top-left')) return 'top-left';
      if (result.includes('top-right')) return 'top-right';
      if (result.includes('bottom-left')) return 'bottom-left';
      return 'bottom-right'; // Default
    });
  } catch (e) {
    return 'bottom-right';
  }
};

const applyLogoOverlay = async (
  base64Image: string, 
  logoDark?: string, 
  logoLight?: string,
  position: LogoPosition = 'bottom-right'
): Promise<string> => {
  if (!logoDark && !logoLight) return base64Image;

  try {
    const mainImg = await loadImage(base64Image);
    const canvas = document.createElement('canvas');
    canvas.width = mainImg.width;
    canvas.height = mainImg.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return base64Image;

    ctx.drawImage(mainImg, 0, 0);

    const padding = mainImg.width * 0.05;
    const logoWidth = mainImg.width * 0.20; // Slightly smaller for flexible placement
    
    // Calculate coordinates based on position
    let x = padding;
    let y = padding;

    if (position.includes('right')) {
      x = mainImg.width - logoWidth - padding;
    }
    if (position.includes('bottom')) {
      // We need logoHeight to calculate y for bottom positions, 
      // but we'll calculate it after selecting the logo
    }

    let selectedLogoBase64 = logoLight || logoDark;
    if (logoDark && logoLight) {
      // Sample brightness at the target position
      // For simplicity, we'll sample a square area at the corner
      const sampleX = position.includes('right') ? mainImg.width - logoWidth - padding : padding;
      const sampleY = position.includes('bottom') ? mainImg.height - (logoWidth * 0.6) - padding : padding;
      
      const brightness = getBrightness(
        ctx, 
        sampleX, 
        sampleY, 
        logoWidth, 
        logoWidth * 0.6
      );
      selectedLogoBase64 = brightness > 160 ? logoDark : logoLight;
    }

    if (!selectedLogoBase64) return base64Image;

    const logoImg = await loadImage(selectedLogoBase64);
    const logoHeight = (logoImg.height / logoImg.width) * logoWidth;

    if (position.includes('bottom')) {
      y = mainImg.height - logoHeight - padding;
    }

    // Ensure the logo is drawn with high quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.drawImage(logoImg, x, y, logoWidth, logoHeight);

    // Convert to JPEG with compression to stay under 1MB Firestore limit
    // We also limit the max dimension to ensure reasonable file sizes
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (error) {
    console.error("Error applying logo overlay:", error);
    return base64Image;
  }
};

export const generateImageWithPixazo = async (prompt: string, apiKey: string) => {
  try {
    const response = await fetch("https://api.pixazo.ai/v1/images/generations", {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json"
      },
      body: JSON.stringify({
        prompt: prompt,
        n: 1,
        num_images: 1, // Providing both for compatibility
        size: "1024x1024",
        response_format: "b64_json" // Prefer base64 to avoid CORS issues with returned URLs
      })
    });

    if (!response.ok) {
      let errorDetail = "Unknown error";
      try {
        const err = await response.json();
        errorDetail = err.message || err.error?.message || JSON.stringify(err);
      } catch (e) {
        errorDetail = response.statusText;
      }
      throw new Error(`Pixazo API error (${response.status}): ${errorDetail}`);
    }

    const data = await response.json();
    // Robust parsing for different possible response formats
    const result = data.data?.[0]?.url || 
                   data.data?.[0]?.b64_json || 
                   data.images?.[0]?.url || 
                   data.url || 
                   data.image || 
                   data.images?.[0]?.b64_json;

    if (!result) {
       console.error("Pixazo partial response:", data);
       throw new Error("No image data found in Pixazo response");
    }
    
    // If it's already a full URL or base64 data uri, return as is
    if (result.startsWith('http') || result.startsWith('data:')) {
      return result;
    }
    
    // Most likely it's a raw base64 string
    return `data:image/png;base64,${result}`;
  } catch (error: any) {
    console.error("Pixazo Image Generation Failed:", error);
    throw error;
  }
};

export const generatePostImage = async (
  postContent: string, 
  brandGuidelines?: string, 
  brandLogoDark?: string, 
  brandLogoLight?: string, 
  brandWebsite?: string, 
  imageStyle: string = "Photorealistic",
  imageType: "Single" | "Carousel" = "Single",
  carouselCount: number = 3,
  pixazoApiKey?: string
) => {
  const images: string[] = [];
  const count = imageType === "Carousel" ? carouselCount : 1;

  for (let i = 0; i < count; i++) {
    let prompt = `Act as a professional brand designer. Create a high-quality, professional social media illustration or photo that visually represents the following post content. 
    Post Type: ${imageType} post ${imageType === "Carousel" ? `(Slide ${i + 1} of ${count})` : ""}. 
    Style: ${imageStyle}. 
    Content: ${postContent}

    STRICT VISUAL RULES:
    - DO NOT include any text, typography, or the post content itself within the image.
    - DO NOT generate, draw, or include any logos, brand marks, or icons in the image.
    - The image should be a clean, professional visual without any graphic design overlays.
    - Focus on the scene, atmosphere, and subject matter.`;
    
    if (brandGuidelines) {
      prompt += `\n\nCRITICAL BRAND GUIDELINES (MUST FOLLOW EXACTLY): ${brandGuidelines}`;
    }

    if (brandWebsite) {
      prompt += `\n\nBrand Website for visual context: ${brandWebsite}`;
    }

    const parts: any[] = [{ text: prompt }];

    if (brandLogoDark || brandLogoLight) {
      prompt += `\n\nCRITICAL BRANDING REQUIREMENT:
      - A high-fidelity logo will be placed programmatically as an overlay after generation.
      - DO NOT attempt to draw the logo yourself.
      - Ensure at least one corner of the image has a 'clear space' zone with high contrast to ensure logo legibility.
      - Use the attached logo(s) as a reference for brand colors and overall aesthetic.`;
      
      parts[0].text = prompt;
      
      if (brandLogoDark) {
        const base64Data = brandLogoDark.split(',')[1];
        const mimeType = brandLogoDark.split(';')[0].split(':')[1];
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
        parts.push({ text: "Dark Logo (Reference Only)" });
      }
      
      if (brandLogoLight) {
        const base64Data = brandLogoLight.split(',')[1];
        const mimeType = brandLogoLight.split(';')[0].split(':')[1];
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
        parts.push({ text: "Light Logo (Reference Only)" });
      }
      
      parts[0].text = prompt;
    }
    
    // Check if we should use Pixazo as primary or fallback
    const hasPaidKey = apiKeys.some(k => k.key === process.env.API_KEY && k.status === "Active");
    const hasAnyActiveGemini = apiKeys.some(k => k.status === "Active" && k.key.startsWith("AIza"));
    
    let generatedImg: string | null = null;
    
    // 1. Primary Generation Path: Use Pixazo if key is provided (as it's requested to be default)
    if (pixazoApiKey) {
      try {
        generatedImg = await generateImageWithPixazo(prompt, pixazoApiKey);
      } catch (err) {
        console.warn("Pixazo Generation attempt failed, falling back to Gemini:", err);
      }
    }

    // 2. Fallback Generation Path: Gemini
    if (!generatedImg) {
      const model = hasPaidKey ? "gemini-3.1-flash-image-preview" : "gemini-2.5-flash-image";

      generatedImg = await callWithRetry(async (ai) => {
        const imageConfig: any = {
          aspectRatio: "1:1",
        };

        // imageSize is only supported for certain models
        if (model === "gemini-3.1-flash-image-preview") {
          imageConfig.imageSize = hasPaidKey ? "1K" : "512px";
        }

        const response = await ai.models.generateContent({
          model,
          contents: [{ parts }],
          config: {
            imageConfig
          }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
        
        return null;
      });
    }

    if (generatedImg) {
      // 1. Determine the best placement for the logo using vision analysis
      const position = await determineLogoPlacement(generatedImg);
      
      // 2. Apply the programmatic overlay for 100% logo fidelity and COMPRESS
      // applyLogoOverlay now returns JPEG at 0.8 quality which is much smaller than PNG
      let finalImg = await applyLogoOverlay(generatedImg, brandLogoDark, brandLogoLight, position);
      
      // Safety check: if it's still somehow over 800KB (leaving some room for the rest of the doc),
      // we perform a more aggressive compression/resize
      if (finalImg.length > 800000) {
        try {
          const img = await loadImage(finalImg);
          const canvas = document.createElement('canvas');
          const maxDim = 800; // Limit to 800px
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxDim) {
              height *= maxDim / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width *= maxDim / height;
              height = maxDim;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            finalImg = canvas.toDataURL('image/jpeg', 0.6); // Lower quality for safety
          }
        } catch (err) {
          console.error("Secondary compression failed:", err);
        }
      }
      images.push(finalImg);
    }
  }

  return imageType === "Carousel" ? images : (images[0] || null);
};
