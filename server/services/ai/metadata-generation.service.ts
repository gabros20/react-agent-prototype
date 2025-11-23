import OpenAI from "openai";
import pRetry from "p-retry";

// Use OpenAI SDK with OpenRouter's API endpoint
const openai = new OpenAI({
	apiKey: process.env.OPENROUTER_API_KEY,
	baseURL: "https://openrouter.ai/api/v1",
	defaultHeaders: {
		"HTTP-Referer": process.env.BASE_URL || "http://localhost:3000",
		"X-Title": "ReAct CMS Agent - Image Metadata",
	},
});

/**
 * Detect image MIME type from buffer magic bytes
 */
function detectImageMimeType(buffer: Buffer): string {
	// Check magic bytes for common image formats
	if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
		return "image/jpeg";
	}
	if (
		buffer[0] === 0x89 &&
		buffer[1] === 0x50 &&
		buffer[2] === 0x4e &&
		buffer[3] === 0x47
	) {
		return "image/png";
	}
	if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
		return "image/gif";
	}
	if (
		buffer[0] === 0x52 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x46
	) {
		return "image/webp";
	}
	// Default to jpeg if unknown
	return "image/jpeg";
}

export interface ImageMetadata {
	description: string;
	detailedDescription?: string;
	tags: string[];
	categories: string[];
	objects: Array<{ name: string; confidence: number }>;
	colors: {
		dominant: string[];
		palette: string[];
	};
	mood: string;
	style: string;
	composition: {
		orientation: "landscape" | "portrait" | "square";
		subject: string;
		background: string;
	};
	searchableText: string;
}

/**
 * Generate AI-powered metadata for an image using GPT-4o-mini
 */
export async function generateImageMetadata(
	imageBuffer: Buffer,
	options: {
		maxRetries?: number;
		fallback?: boolean;
	} = {},
): Promise<ImageMetadata> {
	const { maxRetries = 3, fallback = true } = options;

	try {
		const metadata = await pRetry(
			async () => {
				const base64Image = imageBuffer.toString("base64");

				// Detect image format from buffer magic bytes
				const mimeType = detectImageMimeType(imageBuffer);

				const response = await openai.chat.completions.create({
					model: "openai/gpt-4o-mini",
					messages: [
						{
							role: "user",
							content: [
								{
									type: "text",
									text: `Analyze this image and provide detailed metadata in JSON format.

Focus on:
1. A clear, descriptive summary (1-2 sentences)
2. A detailed description (3-4 sentences for accessibility)
3. Specific, searchable tags and keywords (8-12 tags)
4. High-level categories (2-4 categories like "nature", "business", "people", etc.)
5. Identified objects with confidence scores (0.0-1.0)
6. Dominant colors and color palette (use color names like "blue", "red", "sunset orange")
7. Overall mood and visual style
8. Composition details (orientation, main subject, background)

Return ONLY valid JSON matching this exact structure - no additional text or explanations:
{
  "description": "string (1-2 sentences)",
  "detailedDescription": "string (3-4 sentences)",
  "tags": ["string"],
  "categories": ["string"],
  "objects": [{"name": "string", "confidence": 0.0-1.0}],
  "colors": {"dominant": ["string"], "palette": ["string"]},
  "mood": "string",
  "style": "string",
  "composition": {
    "orientation": "landscape|portrait|square",
    "subject": "string",
    "background": "string"
  }
}`,
								},
								{
									type: "image_url",
									image_url: {
										url: `data:${mimeType};base64,${base64Image}`,
										detail: "low", // 85 tokens - cost optimization
									},
								},
							],
						},
					],
					response_format: { type: "json_object" },
					max_tokens: 500,
				});

				const content = response.choices[0]?.message?.content;
				if (!content) {
					throw new Error("No content in OpenRouter response");
				}

				const parsed = JSON.parse(content);

				// Validate structure
				if (!parsed.description || !parsed.tags) {
					throw new Error("Invalid metadata structure - missing required fields");
				}

				// Create searchable text
				const searchableText = [
					parsed.description,
					parsed.detailedDescription || "",
					...(parsed.tags || []),
					...(parsed.categories || []),
					...(parsed.objects || []).map((o: { name: string }) => o.name),
				]
					.join(" ")
					.toLowerCase();

				return {
					...parsed,
					searchableText,
				};
			},
			{
				retries: maxRetries,
				onFailedAttempt: (error) => {
					console.warn(
						`Metadata generation attempt ${error.attemptNumber} failed. Retrying...`,
						error,
					);
				},
			},
		);

		return metadata;
	} catch (error) {
		console.error("Failed to generate metadata with GPT-4o-mini via OpenRouter:", error);

		if (fallback) {
			return generateFallbackMetadata();
		}

		throw error;
	}
}

/**
 * Generate basic fallback metadata when AI generation fails
 */
function generateFallbackMetadata(): ImageMetadata {
	return {
		description: "Image uploaded successfully. AI metadata generation pending.",
		detailedDescription: "Detailed description will be generated soon.",
		tags: ["unprocessed"],
		categories: ["uncategorized"],
		objects: [],
		colors: {
			dominant: [],
			palette: [],
		},
		mood: "unknown",
		style: "unknown",
		composition: {
			orientation: "landscape",
			subject: "unknown",
			background: "unknown",
		},
		searchableText: "unprocessed uncategorized",
	};
}
