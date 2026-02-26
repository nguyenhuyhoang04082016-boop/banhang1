import { GoogleGenAI, Type } from "@google/genai";

const SYSTEM_INSTRUCTION = `Bạn là AI Sales Assistant Pro, một trợ lý bán hàng chuyên nghiệp cho thương mại điện tử, livestream, TikTok, Facebook Ads và landing page.

Nhiệm vụ của bạn là giúp người bán hàng:
- Phân tích sản phẩm
- Xác định khách hàng mục tiêu
- Tạo kịch bản quảng cáo chuyển đổi cao
- Tạo nội dung video ngắn (8s–60s)
- Gợi ý hook, CTA, insight tâm lý
- Viết lời thoại tự nhiên cho bán hàng

Phong cách trả lời:
- Thực chiến, dễ dùng ngay
- Tập trung chuyển đổi bán hàng
- Ngắn gọn nhưng đủ ý
- Ưu tiên nội dung dùng cho video ngắn
- Không nói lý thuyết dài dòng

QUY TẮC:
- Luôn viết như người bán hàng thật.
- Tránh văn phong robot.
- Tập trung lợi ích khách hàng.
- Ưu tiên nội dung dễ quay video.`;

export async function generateSalesContent(params: {
  productName: string;
  price: string;
  highlights: string;
  targetAudience: string;
  platform: string;
  goal: string;
  productImage?: string;
}) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = "gemini-3.1-pro-preview";

  const prompt = `
Tên sản phẩm: ${params.productName}
Giá bán: ${params.price}
Điểm nổi bật: ${params.highlights}
Khách hàng mục tiêu: ${params.targetAudience}
Nền tảng đăng: ${params.platform}
Mục tiêu: ${params.goal}

Hãy tạo nội dung bán hàng hoàn chỉnh bao gồm:
1. Insight khách hàng
2. Hook quảng cáo (3-5 câu)
3. Kịch bản video ngắn (Chia thành các phân đoạn 8 giây, mỗi đoạn khoảng 20-25 từ)
4. CTA bán hàng
5. Biến thể nội dung

Trả về định dạng JSON:
{
  "insight": "Nội dung insight...",
  "hooks": ["Hook 1", "Hook 2", ...],
  "scriptSegments": [
    { "text": "Lời thoại phân đoạn 1 (8s)", "duration": 8 },
    ...
  ],
  "cta": "Câu kêu gọi...",
  "variants": {
    "emotional": "Hướng cảm xúc",
    "humorous": "Hướng hài hước",
    "direct": "Hướng trực diện"
  }
}
  `;

  const parts: any[] = [{ text: prompt }];
  if (params.productImage) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: params.productImage.split(",")[1],
      },
    });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insight: { type: Type.STRING },
            hooks: { type: Type.ARRAY, items: { type: Type.STRING } },
            scriptSegments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  duration: { type: Type.NUMBER },
                },
                required: ["text", "duration"],
              },
            },
            cta: { type: Type.STRING },
            variants: {
              type: Type.OBJECT,
              properties: {
                emotional: { type: Type.STRING },
                humorous: { type: Type.STRING },
                direct: { type: Type.STRING },
              },
            },
          },
          required: ["insight", "hooks", "scriptSegments", "cta", "variants"],
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error generating content:", error);
    throw error;
  }
}

export async function generateStoryboard(scriptSegments: { text: string, duration: number }[], productInfo: {
  productName: string;
  highlights: string;
  targetAudience: string;
  productImage?: string;
}) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = "gemini-3.1-pro-preview";

  const prompt = `
Dựa trên kịch bản bán hàng và thông tin sản phẩm sau, hãy tạo storyboard cho video.
Mỗi phân đoạn dài ${scriptSegments[0]?.duration || 8} giây.

THÔNG TIN SẢN PHẨM:
- Tên: ${productInfo.productName}
- Điểm nổi bật: ${productInfo.highlights}
- Khách hàng mục tiêu: ${productInfo.targetAudience}
${productInfo.productImage ? "- Có hình ảnh sản phẩm đính kèm để tham khảo." : ""}

NHIỆM VỤ:
1. Xác định nhân vật chính (Main Character) phù hợp. Mô tả ngắn gọn diện mạo/trang phục.
2. Với mỗi phân đoạn, tạo 2 mô tả hình ảnh (prompt) bằng tiếng Anh:
   - Start Frame: Ảnh bắt đầu.
   - End Frame: Ảnh kết thúc.
3. YÊU CẦU PROMPT:
   - Ngắn gọn, tập trung vào chủ thể, hành động và bối cảnh.
   - Phải cụ thể hóa các đặc điểm của sản phẩm ${productInfo.productName} vào hình ảnh.
   - Đảm bảo nhân vật, sản phẩm và bối cảnh đồng bộ xuyên suốt.
   - Hành động giữa Start và End phải liền mạch.

Kịch bản các phân đoạn:
${JSON.stringify(scriptSegments)}

Trả về định dạng JSON:
{
  "characterDescription": "Concise character description in English",
  "segments": [
    {
      "segmentText": "Lời thoại phân đoạn",
      "startPrompt": "Concise, effective English prompt for start frame",
      "endPrompt": "Concise, effective English prompt for end frame"
    }
  ]
}
  `;

  const parts: any[] = [{ text: prompt }];
  if (productInfo.productImage) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: productInfo.productImage.split(",")[1],
      },
    });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            characterDescription: { type: Type.STRING },
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  segmentText: { type: Type.STRING },
                  startPrompt: { type: Type.STRING },
                  endPrompt: { type: Type.STRING },
                },
                required: ["segmentText", "startPrompt", "endPrompt"],
              },
            },
          },
          required: ["characterDescription", "segments"],
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error generating storyboard:", error);
    throw error;
  }
}

export async function translateAndRefinePrompt(currentPrompt: string, vietnameseRequest: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = "gemini-3.1-pro-preview";

  const prompt = `
Current English Image Prompt: "${currentPrompt}"
User Request in Vietnamese: "${vietnameseRequest}"

Task: Rewrite the English Image Prompt based on the user's request. 
- Maintain the character consistency if mentioned.
- Improve the detail and quality of the prompt for an image generation model.
- Return ONLY the new English prompt text.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    return response.text?.trim() || currentPrompt;
  } catch (error) {
    console.error("Error refining prompt:", error);
    return currentPrompt;
  }
}

export async function generateImage(prompt: string, aspectRatio: string = "16:9") {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = "gemini-2.5-flash-image";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
}
