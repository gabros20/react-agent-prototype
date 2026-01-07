# Multimodal AI Agents 2024-2025

Comprehensive research on vision, audio, and document understanding agents with production-ready implementation patterns.

---

## Table of Contents

1. [Vision + Language Agents](#vision--language-agents)
2. [Vision Agent Architectures](#vision-agent-architectures)
3. [Audio & Speech Integration](#audio--speech-integration)
4. [Document Understanding](#document-understanding)
5. [Image Generation Tools](#image-generation-tools)
6. [Unified Multimodal Tool Design](#unified-multimodal-tool-design)
7. [Production Systems & Case Studies](#production-systems--case-studies)
8. [Benchmarks & Evaluation](#benchmarks--evaluation)
9. [Implementation Patterns](#implementation-patterns)
10. [Code Examples](#code-examples)

---

## Vision + Language Agents

### Major Models (2024-2025)

#### GPT-4V/GPT-4o (OpenAI)
- **Architecture**: Single end-to-end model trained across text, vision, and audio
- **Capabilities**: Image understanding, chart interpretation, handwriting recognition, OCR
- **Strength**: Nuanced interpretation of complex images, charts, and documents
- **Model ID**: `gpt-4o-2024-11-20` (Nov 2024 release)
- **Vision Features**: Introduced to public in late 2023
- **Tool Calling**: Function calling with vision enables multimodal use cases beyond OCR

#### Gemini 2.0/3.0 (Google)
- **Architecture**: Built from the ground up as natively multimodal
- **Capabilities**: Seamlessly synthesizes across text, images, audio, and video
- **Context Window**: 1M tokens (largest in class)
- **Strength**: Overall reasoning benchmarks, agent-first design
- **Integration**: Tight coupling with Gemini Agent and Antigravity environment
- **Modality Support**: Text, images, audio, video as first-class citizens

#### Claude 3.5/4.5 (Anthropic)
- **Vision Launch**: Added vision capabilities in Claude 3
- **Performance**: Claude 3.5 Sonnet surpassed Claude 3 in vision tasks
- **Strengths**: Interpreting graphs, extracting text from images
- **Computer Use**: First frontier model offering computer use in public beta (Oct 2024)
- **Methodology**: Vision-only approach using real-time screenshots

### Multimodal LLM Architecture

All multimodal large language models (MLLMs) share a three-part architecture:

1. **Modality Encoder**: Condenses raw data formats (visuals, sound) into streamlined representations
2. **Fusion Layer**: Combines features from different modalities into unified representation
3. **Language Model**: Processes unified representation for reasoning and generation

**Key Insight (2025)**: Stop viewing GPT-4V, Gemini, and Claude as standalone winners—they are powerful cognitive engines integrated into broader AI Perception Systems, where the LLM handles high-level reasoning and language interaction.

---

## Vision Agent Architectures

### Claude Computer Use

**Release**: October 2024 (Claude 3.5 Sonnet)

#### Technical Architecture

```
┌─────────────────────────────────────────┐
│  Claude 3.5 Sonnet (Vision Model)       │
│                                         │
│  Input: Real-time screenshots          │
│  Output: Mouse/keyboard actions         │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│  Sandboxed Computing Environment        │
│                                         │
│  • Virtual Display (Xvfb)               │
│  • Window Manager + Panel (Linux)       │
│  • Pre-installed Apps (Firefox,         │
│    LibreOffice, text editors)           │
└─────────────────────────────────────────┘
```

#### Key Design Principles

1. **Vision-Only Methodology**: Relies exclusively on visual input from screenshots
   - No access to DOM, accessibility trees, or APIs
   - Mimics human interaction with desktop interfaces
   - Works with closed-source software without API dependencies

2. **Schema-Less Tool**: Computer use tool has no customizable input schema
   - Schema built into Claude's model
   - Cannot be modified by developers
   - Simplifies implementation

3. **Display Recommendations**:
   - Keep resolutions at or below XGA (1024x768)
   - Significantly improves processing speed and accuracy
   - Balances visual detail with inference performance

4. **Safety**: Requires sandboxed environment for production use

#### Agent SDK Design Philosophy

> "The key design principle behind the Claude Agent SDK is to give your agents a computer, allowing them to work like humans do."

This unlocks agents that are more effective than API-based automation.

### WebVoyager: End-to-End Web Agent

**Release**: January 2024
**Paper**: [arXiv:2401.13919](https://arxiv.org/abs/2401.13919)

#### Performance

- **Success Rate**: 59.1% on WebVoyager benchmark
- **Comparison**: Significantly surpasses GPT-4 (All Tools) and text-only setups
- **SeeAct Benchmark**: 30% success vs SeeAct's best autonomous agent at 26%

#### Benchmark Dataset

- **Tasks**: 643 diverse tasks
- **Websites**: 15 real-world websites (Amazon, Apple, Google Flights, BBC News, etc.)
- **Scenarios**: Shopping, information retrieval, online reservation
- **Evaluation**: Automatic metric with 85.3% agreement with human judgment

#### Technical Approach

**Visual Context + Text Fusion**:
```
Screenshot → Bounding Box Annotations → Visual Understanding
     +                                          ↓
Page DOM Text → Semantic Extraction → Combined Reasoning → Action
```

Key insight: Combining page text with visual context (screenshots annotated with bounding boxes) greatly improves element interaction accuracy.

### SeeAct: Visual Web Interaction

**Release**: 2024
**Authors**: Zheng et al.

#### Approach

- Leverages Large Multimodal Models (LMMs) for integrated visual understanding and actions
- Relies on finetuned cross-encoder model for candidate element selection
- Combines vision with interaction prediction

#### Limitations

- Best SeeAct autonomous agent: 26% success rate (vs WebVoyager's 30%)
- Dependency on finetuned models reduces generalization

### SeeClick: GUI Grounding

**Release**: January 2024
**Conference**: ACL 2024

#### Core Innovation: GUI Grounding

**Definition**: The capacity to accurately locate screen elements based on instructions

#### Technical Approach

1. **GUI Grounding Pre-training**: Specialized training on element detection
2. **Automated Data Curation**: Scalable dataset generation for GUI tasks
3. **Visual-First**: Performs low-level actions (clicking, typing) by observing screenshots

#### ScreenSpot Benchmark

- **First realistic GUI grounding benchmark**
- **Environments**: Mobile, desktop, web
- **Finding**: GUI grounding ability directly correlates with downstream agent task performance

#### Grounding Task Forms

1. **text_2_point**: Predict center point coordinates
2. **text_2_bbox**: Predict bounding box coordinates

### OSCAR: Operating System Control

**Full Name**: Operating System Control via State-Aware Reasoning and Re-Planning
**Release**: October 2024
**Paper**: [arXiv:2410.18963](https://arxiv.org/abs/2410.18963)

#### Innovations

- **State-Aware Reasoning**: Maintains understanding of current OS state
- **Re-Planning**: Dynamically adapts when task execution fails
- **Real-time Feedback**: Incorporates OS feedback for error recovery
- **Executable Environments**: Crucial for navigating new GUI environments

### Set-of-Mark (SoM) Prompting

**Release**: October 2023
**Paper**: [arXiv:2310.11441](https://arxiv.org/abs/2310.11441)

#### Technique

Visual prompting method that unleashes visual grounding in GPT-4V:

```
Original Image
     ↓
Interactive Segmentation (SEEM/SAM)
     ↓
Partition into regions at different granularities
     ↓
Overlay marks (alphanumerics, masks, boxes)
     ↓
Model refers to "element #5" instead of ambiguous descriptions
```

#### Implementation

1. Use off-the-shelf segmentation models (SEEM/SAM)
2. Overlay numbered markers on screenshot
3. Instruct model to identify objects by labels

#### Applications in GUI Agents

- **Widely adopted** in GUI scenarios
- **Advantage**: Precise element referencing
- **Limitation**: Suboptimal on complex webpage screenshots with rich semantic and spatial relationships
- **Dependency**: Requires complete object information or object segmentation

#### Alternative Approaches

**JavaScript Annotation** (for web agents):
- Automatically annotate every interactable element with bounding box + unique ID
- Provides programmatic grounding without segmentation models

### Visual Grounding Techniques Summary

| Technique | Approach | Strengths | Limitations |
|-----------|----------|-----------|-------------|
| **Set-of-Mark** | Overlay numbered marks | Precise referencing | Needs segmentation, poor on complex layouts |
| **Bounding Boxes** | Red boxes + arrows | Simple, visual | Manual annotation effort |
| **JavaScript IDs** | Auto-annotate DOM | Programmatic, scalable | Web-only, requires DOM access |
| **Vision-Only** | Raw screenshots | General, no API needed | Lower precision |

---

## Audio & Speech Integration

### OpenAI Realtime API

**Latest Release**: gpt-realtime (2025)
**Announcement**: [OpenAI Blog](https://openai.com/index/introducing-gpt-realtime/)

#### Architecture

End-to-end speech-to-speech model with integrated reasoning:

```
Audio Input → Speech-to-Speech Model → Audio Output
                        ↓
                Text Reasoning Layer
                        ↓
            Tool Calling & Function Execution
```

#### Performance Improvements

**MultiChallenge Audio Benchmark** (instruction following accuracy):
- **gpt-realtime (2025)**: 30.5%
- **Previous model (Dec 2024)**: 20.6%
- **Improvement**: +48% relative gain

#### New Capabilities (2025)

1. **Model Context Protocol (MCP) Server Support**: Standard integration with data sources
2. **Image Input**: Multimodal conversations with vision
3. **SIP Phone Calling**: Direct telephony integration for production voice agents

#### Model Variants

- **Realtime API**: Full-size model for complex reasoning
- **Realtime mini**: Optimized for tool calling and instruction following
- **Audio mini**: Reduced intelligence gap vs full-size model

### Gemini Live API

**Release**: General availability on Vertex AI (2024)
**Model**: Gemini 2.5 Flash Native Audio
**Docs**: [Google Cloud](https://cloud.google.com/blog/products/ai-machine-learning/gemini-live-api-available-on-vertex-ai)

#### Architecture Philosophy

**Paradigm Shift**: From rigid, multi-stage voice systems → single, real-time, emotionally aware, multimodal conversational architecture

```
Traditional Voice System:
Audio → STT → LLM → TTS → Audio
(3 separate models, latency at each step)

Gemini Live:
Audio → Native Audio Model → Audio
(Single model, native audio understanding)
```

#### Key Capabilities

1. **Affective Dialogue with Emotional Intelligence**
   - Natively processes raw audio (not transcription)
   - Interprets tone, emotion, pace
   - Auto de-escalates stressful support calls
   - Adopts empathetic tone dynamically

2. **Real-time Tool Integration**
   - Function Calling in conversation
   - Grounding with Google Search
   - Execute complex actions immediately
   - No separate orchestration layer needed

3. **Improved Complex Workflows**
   - Gemini 2.5 Flash: Better at complex workflows
   - Navigate multi-turn user instructions
   - Hold natural conversations across modalities

#### Industry Applications

- E-commerce and retail
- Gaming (NPC interactions)
- Healthcare (patient support)
- Financial services (advisory)
- Education (tutoring)

#### Integration Options

**LiveKit Plugin**: Production-ready integration for Gemini Live API
- [LiveKit Docs](https://docs.livekit.io/agents/models/realtime/plugins/gemini/)
- Queue-based concurrency
- FastAPI integration patterns

### Whisper: Speech Recognition

**Developer**: OpenAI
**Training Data**: 680,000 hours of multilingual, supervised data
**Models**: Available on [Hugging Face](https://huggingface.co/openai/whisper-large-v3)

#### Architecture

**Encoder-Decoder Transformer**:

```
Audio → 30-second chunks → Log-Mel Spectrogram → Encoder
                                                      ↓
                                               Decoder → Text
```

Simple end-to-end approach for multiple speech tasks.

#### Multitasking Capabilities

1. **Multilingual Speech Recognition**: 99+ languages
2. **Speech Translation**: Translate to English
3. **Language Identification**: Auto-detect source language

#### Integration Patterns

**Two Streaming Approaches**:

1. **Completed Recording**:
   ```python
   # Transcription API with stream=True
   with open("audio.mp3", "rb") as audio:
       transcript = client.audio.transcriptions.create(
           model="whisper-1",
           file=audio,
           stream=True
       )
   ```

2. **Ongoing Stream**:
   - Real-time audio chunks
   - Continuous inference pipeline
   - Evolving from batch to streaming architectures

#### Deployment Options

**Azure OpenAI vs Azure Speech**:

| Feature | Azure OpenAI | Azure Speech Batch |
|---------|--------------|-------------------|
| **Max File Size** | 25MB | 1GB |
| **Batch Processing** | Limited | Large batches |
| **Integration** | Simple API | Enterprise features |
| **Use Case** | Real-time, small files | Bulk transcription |

#### Future Directions

1. **Multimodal Integration**: Combine audio with visual cues from video
2. **End-to-End Streaming**: True real-time performance
3. **Continuous Inference**: Handle indefinite audio streams without batching

### Audio Agent Implementation Patterns

#### Pattern 1: STT → LLM → TTS (Traditional)

```typescript
// Traditional pipeline
const transcript = await whisper.transcribe(audioInput);
const response = await llm.complete(transcript);
const audio = await tts.synthesize(response);
```

**Pros**: Model flexibility, debuggable
**Cons**: Latency, loses prosody information

#### Pattern 2: Native Audio Models (Modern)

```typescript
// Gemini Live / OpenAI Realtime
const stream = await geminiLive.connect({
  audioInput: micStream,
  tools: [searchTool, databaseTool],
});

for await (const event of stream) {
  if (event.type === 'audio') {
    playAudio(event.data);
  } else if (event.type === 'tool_call') {
    const result = await executeTool(event.tool, event.args);
    stream.send({ type: 'tool_result', result });
  }
}
```

**Pros**: Low latency, emotion preservation, integrated reasoning
**Cons**: Less model choice, newer pattern

---

## Document Understanding

### Multimodal RAG Architectures

**Definition**: Retrieval-Augmented Generation incorporating text, images, charts, and tables from documents.

#### Why Multimodal RAG?

**Traditional Text-Only RAG Limitations**:
- Loses information in charts, diagrams, tables
- OCR errors in complex layouts
- Missing visual context (flowcharts, technical diagrams)

**Multimodal RAG Advantages**:
- Captures nuances lost in text-only analysis
- Provides contextually relevant responses with visual understanding
- Enhances comprehension through visual aids
- Improves quality/depth of generated content

#### Financial Document Example

> "In financial contexts, Multimodal RAG can efficiently interpret PDFs with complex tables, charts, and visualizations, significantly improving response accuracy."

### ColPali: Vision-Native Document Retrieval

**Release**: July 2024
**Paper**: [arXiv:2407.01449](https://arxiv.org/abs/2407.01449)
**Hugging Face**: [vidore/colpali](https://huggingface.co/vidore/colpali)

#### Revolutionary Approach

**Traditional Pipeline**:
```
PDF → OCR → Text Extraction → Layout Analysis → Chunking → Embedding
```

**ColPali Pipeline**:
```
PDF → Screenshot Each Page → Vision Embedding → Done
```

#### Technical Architecture

**Base Model**: PaliGemma-3B extension
**Retrieval Method**: ColBERT-style multi-vector representations

```
PDF Page (as image)
     ↓
PaliGemma Vision Encoder
     ↓
Multi-Vector Embeddings (one per visual patch)
     ↓
Late Interaction Matching (ColBERT)
     ↓
Relevance Score
```

#### Performance

**ViDoRe Benchmark** (Visual Document Retrieval):

| Method | nDCG@5 |
|--------|--------|
| **ColPali** | **81.3** |
| BGE-M3 | 75 |
| BM25 | 65 |

**Indexing Speed**:
- **ColPali**: 0.4 seconds/page
- **Traditional OCR pipeline**: 7.22 seconds/page
- **Speedup**: 18x faster

#### ViDoRe Benchmark

- **First vision-centric document retrieval benchmark**
- **Tasks**: Page-level retrieval across domains
- **Languages**: Multilingual
- **Settings**: Various practical scenarios (academic papers, technical docs, financial reports)

#### When to Use ColPali

**Ideal For**:
- Complex visual documents (flowcharts, diagrams, infographics)
- Multi-language documents
- Documents with poor OCR quality
- Speed-critical retrieval

**Not Ideal For**:
- Pure text documents (traditional RAG is sufficient)
- When you need word-level precision
- Extremely high-resolution images (token limits)

### Vision-Guided Chunking

**Paper**: "Vision-Guided Chunking Is All You Need: Enhancing RAG with Multimodal Document Understanding"
**Release**: 2024

#### Concept

Use vision models to determine optimal chunk boundaries in documents:

```
Traditional Chunking:
Split every N tokens, ignore document structure

Vision-Guided Chunking:
Screenshot → Vision Model analyzes layout → Split at semantic boundaries
```

#### Benefits

- Respects visual structure (sections, tables, figures)
- Preserves semantic coherence
- Improves retrieval relevance
- Better handles complex layouts

### Multimodal RAG Implementation Pattern

```typescript
// Hybrid approach: Vision + Text
async function multimodalRAG(query: string, documentId: string) {
  // 1. Retrieve relevant pages (ColPali vision embeddings)
  const relevantPages = await colpaliRetriever.retrieve({
    query,
    documentId,
    topK: 5
  });

  // 2. For each page, extract both visual and text information
  const enrichedContext = await Promise.all(
    relevantPages.map(async (page) => {
      const visualDescription = await visionModel.describe(page.image);
      const extractedText = page.ocrText || "";
      const tables = await tableExtractor.extract(page.image);

      return {
        visual: visualDescription,
        text: extractedText,
        tables: tables,
        pageNumber: page.number
      };
    })
  );

  // 3. Construct multimodal prompt
  const context = enrichedContext.map(ctx =>
    `Page ${ctx.pageNumber}:\n` +
    `Visual: ${ctx.visual}\n` +
    `Text: ${ctx.text}\n` +
    `Tables: ${JSON.stringify(ctx.tables)}`
  ).join('\n\n');

  // 4. Generate with multimodal LLM
  const response = await llm.complete({
    messages: [
      { role: 'system', content: 'Answer using document context' },
      { role: 'user', content: `Context:\n${context}\n\nQuestion: ${query}` }
    ],
    model: 'gpt-4o' // or gemini-pro, claude-3.5
  });

  return response;
}
```

### Technologies for Document Processing

| Model | Best For | Modalities |
|-------|----------|------------|
| **GPT-4o** | General document Q&A | Text + Images |
| **Gemini Pro** | Long documents (1M context) | Text + Images + Video |
| **Claude 3.5 Sonnet** | Graph/chart interpretation | Text + Images |
| **LLaVA** (open-source) | Cost-sensitive workloads | Text + Images |
| **ColQwen2** | Document retrieval | Vision embeddings |

### Challenges in Document Understanding

**Highly complex figures** still present challenges:
- Intricate flowcharts
- Multi-layered technical diagrams
- Dense statistical charts with embedded sub-elements
- 3D visualizations
- Overlapping annotations

**Current best practice**: Combine vision models with specialized extractors for critical information.

---

## Image Generation Tools

### Model Landscape (2024-2025)

#### FLUX.1 (BlackForestLabs)

**Release**: August 2024
**Team**: Former Stable Diffusion team members

**Three Variants**:

1. **FLUX.1 [pro]**: Highest quality, API-only
   - Best for commercial applications
   - Superior prompt adherence
   - Advanced compositions

2. **FLUX.1 [dev]**: Open weights, non-commercial
   - Good balance of quality and speed
   - Fine-tunable
   - Community-driven

3. **FLUX.1 [schnell]**: Fast generation
   - 1-4 steps
   - Real-time applications
   - Lower quality trade-off

**Architecture**: Combines transformer + diffusion models

#### DALL-E 3 (OpenAI)

**Strengths**:
- Intuitive prompt interpretation
- Excellent text rendering in images
- Strong safety filters
- Integration with ChatGPT

**Architecture**: Transformer-based understanding → detailed image generation

**Use Cases**:
- Creative brainstorming
- Marketing materials
- Quick concept visualization

#### Stable Diffusion 3.5 (Stability AI)

**Strengths**:
- Maximum customization
- LoRA/fine-tuning support
- Local deployment
- Open weights

**Architecture**: Latent diffusion models

**Use Cases**:
- Custom style training
- Privacy-sensitive workloads
- Batch generation
- Research

#### Midjourney v7

**Strengths**:
- Photorealistic quality
- Artistic coherence
- Style consistency

**Limitations**:
- Discord-only interface
- Limited API access

### Integration Patterns for AI Agents

#### Pattern 1: Unified Image Generation Interface

```typescript
interface ImageGenerator {
  generate(params: {
    prompt: string;
    model: 'dalle3' | 'flux-pro' | 'sd3.5';
    style?: string;
    aspectRatio?: string;
  }): Promise<ImageResult>;
}

// Agent tool that routes to appropriate model
const imageGenerationTool = tool({
  description: 'Generate images from text descriptions',
  inputSchema: z.object({
    prompt: z.string(),
    model: z.enum(['dalle3', 'flux-pro', 'sd3.5']).default('flux-pro'),
    style: z.string().optional(),
  }),
  execute: async ({ prompt, model, style }) => {
    const generator = getGenerator(model);
    const image = await generator.generate({ prompt, style });
    return { imageUrl: image.url, model };
  }
});
```

#### Pattern 2: Multi-Model Comparison

Platforms enabling comparison:

- **ChatHub**: DALL·E 3, Flux 1, Stable Diffusion in one interface
- **MaxAI**: Switch between image models + LLMs in same chat
- **Galaxy.ai**: 2,000+ AI tools including multiple image generators

#### Agent Use Case: Design Iteration

```typescript
// Agent workflow for design iteration
async function designIterationAgent(userRequest: string) {
  // 1. Generate initial concepts with multiple models
  const concepts = await Promise.all([
    imageGen.generate({ prompt: userRequest, model: 'dalle3' }),
    imageGen.generate({ prompt: userRequest, model: 'flux-pro' }),
    imageGen.generate({ prompt: userRequest, model: 'sd3.5' }),
  ]);

  // 2. Use vision model to analyze and compare
  const analysis = await visionModel.analyze({
    images: concepts.map(c => c.url),
    prompt: 'Compare these designs. Which best matches: ' + userRequest
  });

  // 3. Iterate on best candidate
  const refinedPrompt = await llm.complete({
    prompt: `Original: ${userRequest}\nAnalysis: ${analysis}\n` +
            `Suggest refined prompt for improvement.`
  });

  // 4. Generate final version
  const final = await imageGen.generate({
    prompt: refinedPrompt,
    model: analysis.bestModel
  });

  return final;
}
```

### Model Specialization Summary

| Model | Photorealism | Prompt Adherence | Customization | Speed | Cost |
|-------|--------------|------------------|---------------|-------|------|
| **Midjourney** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | $$$ |
| **DALL-E 3** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | $$ |
| **FLUX.1 Pro** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | $$$ |
| **Stable Diffusion** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | $ |

---

## Unified Multimodal Tool Design

### Core Concepts

**Definition**: A multimodal AI agent is a system that combines multiple forms of data input—text, images, audio, video—and processes them in a unified model pipeline.

**Integrated Intelligence**: Natural language processing, computer vision, speech recognition, and generation capabilities into a single framework.

### Architecture Patterns

#### Pattern 1: Modality-Agnostic Processing

```
┌─────────────────────────────────────────────────┐
│            Input Layer (Multi-Modal)            │
│  Text │ Image │ Audio │ Video │ Sensor Data    │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│         Feature Extraction (Per Modality)       │
│  • Text: Tokenization                           │
│  • Image: Vision encoder (ViT, CNN)             │
│  • Audio: Spectrogram → Audio encoder           │
│  • Video: Frame sampling → Video encoder        │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│            Fusion Mechanism                     │
│  • Early Fusion: Combine raw features           │
│  • Late Fusion: Combine model outputs           │
│  • Cross-Attention: Modality interactions       │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│         Unified Reasoning Engine (LLM)          │
│  • Cross-modal understanding                    │
│  • Task planning                                │
│  • Tool selection                               │
└─────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│           Output Layer (Multi-Modal)            │
│  Text │ Image │ Audio │ Video │ Actions        │
└─────────────────────────────────────────────────┘
```

#### Pattern 2: Event-Driven Multimodal System

**Separation of Concerns**:

```typescript
// Independent components that communicate via events

interface MultimodalAgent {
  // Core components
  languageReasoning: LanguageProcessor;
  speechRecognition: AudioProcessor;
  visionPerception: VisionProcessor;
  conversationManager: DialogueManager;
  contextualMemory: MemoryStore;
}

// Event-driven communication
class MultimodalEventBus {
  emit(event: {
    type: 'speech' | 'vision' | 'text' | 'context';
    data: any;
    timestamp: number;
  }): void;

  subscribe(
    eventType: string,
    handler: (event: any) => void
  ): void;
}

// Example: Voice + Vision + Context integration
speechProcessor.on('utterance', async (audio) => {
  const text = await stt.transcribe(audio);
  eventBus.emit({ type: 'text', data: text, timestamp: Date.now() });
});

visionProcessor.on('frame', async (image) => {
  const analysis = await visionModel.analyze(image);
  eventBus.emit({ type: 'vision', data: analysis, timestamp: Date.now() });
});

contextManager.on('combined', async ({ text, vision }) => {
  const response = await llm.reason({
    userSpeech: text,
    visualContext: vision,
    previousContext: memory.retrieve()
  });
  eventBus.emit({ type: 'response', data: response, timestamp: Date.now() });
});
```

### Model Context Protocol (MCP)

**Purpose**: Standard contract for how components communicate in multimodal systems.

**Key Features**:
- Defines standard message types
- No custom glue code needed
- Vision, speech, text, and tool-calling interoperate
- Enterprise-grade authentication

**Adoption**:
- **Anthropic**: Created MCP
- **OpenAI**: Announced support (2024)
- **Ecosystem**: Thousands of integrations

**Example MCP Integration**:

```typescript
// MCP server for document processing
const documentMCPServer = {
  name: 'document-processor',
  version: '1.0.0',

  tools: [
    {
      name: 'analyze_document',
      description: 'Analyze document with vision + text extraction',
      inputSchema: {
        type: 'object',
        properties: {
          documentUrl: { type: 'string' },
          analysisType: {
            type: 'string',
            enum: ['summary', 'qa', 'extract_tables']
          }
        }
      },
      handler: async (input: any) => {
        // Vision analysis
        const pages = await pdfToImages(input.documentUrl);
        const visionAnalysis = await Promise.all(
          pages.map(p => visionModel.analyze(p))
        );

        // Text extraction
        const text = await ocr.extract(input.documentUrl);

        // Combine modalities
        return {
          vision: visionAnalysis,
          text: text,
          combined: await llm.synthesize({ visionAnalysis, text })
        };
      }
    }
  ]
};

// Agent using MCP
const agent = new Agent({
  mcpServers: [documentMCPServer],
  model: 'claude-3.5-sonnet'
});
```

### Google A2A Protocol

**Purpose**: Open standard for universal agent interoperability.

**Features**:
- Enterprise-grade authentication and authorization
- Supports long-running tasks
- Multimodal interactions (vision, audio, text)
- Agent-to-agent communication

**Use Case**: Large-scale multi-agent system deployment.

```typescript
// A2A protocol example
interface A2AMessage {
  from: AgentId;
  to: AgentId;
  messageType: 'request' | 'response' | 'stream';
  modality: 'text' | 'vision' | 'audio' | 'multimodal';
  content: any;
  auth: AuthToken;
}

// Vision agent communicating with text agent
const visionAgent = new A2AAgent({
  id: 'vision-analyzer',
  capabilities: ['image-understanding', 'ocr', 'object-detection']
});

const textAgent = new A2AAgent({
  id: 'text-processor',
  capabilities: ['summarization', 'qa', 'translation']
});

// Multimodal workflow
visionAgent.send({
  to: textAgent.id,
  messageType: 'request',
  modality: 'multimodal',
  content: {
    image: imageUrl,
    extractedText: await visionAgent.ocr(imageUrl),
    task: 'summarize-document'
  }
});
```

### AI SDK (Vercel) Multimodal Patterns

**Version**: AI SDK 6 (2025)
**Documentation**: [ai-sdk.dev](https://ai-sdk.dev/)

#### Unified Provider Abstraction

```typescript
import { streamText, generateImage, transcribeAudio } from 'ai';

// Text generation
const textStream = await streamText({
  model: openai('gpt-4o'),
  messages: [{ role: 'user', content: 'Explain quantum computing' }]
});

// Image generation
const image = await generateImage({
  model: openai('dall-e-3'),
  prompt: 'A futuristic city'
});

// Audio transcription
const transcript = await transcribeAudio({
  model: openai('whisper-1'),
  audio: audioFile
});

// Multimodal conversation
const response = await streamText({
  model: openai('gpt-4o'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is in this image?' },
        { type: 'image', image: imageUrl }
      ]
    }
  ],
  tools: {
    generateImage: tool({
      description: 'Generate an image',
      parameters: z.object({ prompt: z.string() }),
      execute: async ({ prompt }) => generateImage({ model: openai('dall-e-3'), prompt })
    })
  }
});
```

#### React Hooks for Multimodal UIs

```typescript
'use client';

import { useChat } from 'ai/react';

export default function MultimodalChat() {
  const { messages, input, handleInputChange, handleSubmit, append } = useChat({
    api: '/api/chat',
    maxSteps: 5 // AI SDK 6: Multi-step tool calling
  });

  const handleImageUpload = async (file: File) => {
    const base64 = await fileToBase64(file);

    append({
      role: 'user',
      content: [
        { type: 'text', text: 'Analyze this image' },
        { type: 'image', image: base64 }
      ]
    });
  };

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          {m.content.map((part, i) => {
            if (part.type === 'text') return <p key={i}>{part.text}</p>;
            if (part.type === 'image') return <img key={i} src={part.image} />;
            if (part.type === 'tool-call') return <ToolCall key={i} call={part} />;
          })}
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <input type="file" accept="image/*" onChange={e => handleImageUpload(e.target.files[0])} />
      </form>
    </div>
  );
}
```

#### Speech Support (AI SDK 5+)

```typescript
import { generateSpeech, transcribeSpeech } from 'ai';

// Text to speech
const audio = await generateSpeech({
  model: elevenlabs('eleven_multilingual_v2'),
  text: 'Hello, how can I help you today?',
  voice: 'rachel'
});

// Speech to text
const text = await transcribeSpeech({
  model: deepgram('nova-2'),
  audio: audioBuffer
});

// Provider switching (same API)
const audioOpenAI = await generateSpeech({
  model: openai('tts-1'),
  text: 'Same interface, different provider'
});
```

#### Supported Providers (AI SDK 6)

- OpenAI (GPT-4o, DALL-E 3, Whisper, TTS)
- Anthropic (Claude 3.5, Claude 4.5)
- Google (Gemini 2.0, Gemini 3.0)
- Replicate
- Fireworks
- Cohere
- Together AI
- DeepInfra
- DeepSeek
- Cerebras
- ElevenLabs (speech)
- DeepGram (speech)

### LangChain Multimodal Support

**Models**: GPT-4o, Gemini 1.5, Claude 3

```python
from langchain.chat_models import ChatOpenAI
from langchain.schema.messages import HumanMessage

# Multimodal message
llm = ChatOpenAI(model="gpt-4o")

message = HumanMessage(
    content=[
        {"type": "text", "text": "What's in this image?"},
        {"type": "image_url", "image_url": {"url": image_url}}
    ]
)

response = llm.invoke([message])
```

### LlamaIndex Multimodal Workflows

**Capabilities**: Text, images, audio processing in agentic workflows

```python
from llama_index.multi_modal_llms import OpenAIMultiModal
from llama_index.schema import ImageDocument

# Multimodal query engine
mm_llm = OpenAIMultiModal(model="gpt-4o")

# Combine text and image documents
documents = [
    TextDocument(text="Product description..."),
    ImageDocument(image_path="product.jpg")
]

response = mm_llm.complete(
    prompt="Compare the product description with the image",
    image_documents=[documents[1]]
)
```

### Unified Tool Interface Pattern

```typescript
// Multimodal tool abstraction
interface UnifiedTool {
  name: string;
  description: string;
  inputModalities: ('text' | 'image' | 'audio' | 'video')[];
  outputModalities: ('text' | 'image' | 'audio' | 'video')[];

  execute(input: {
    text?: string;
    images?: string[];
    audio?: Buffer;
    video?: string;
  }): Promise<{
    text?: string;
    images?: string[];
    audio?: Buffer;
    video?: string;
  }>;
}

// Example: Document analysis tool
const documentAnalysisTool: UnifiedTool = {
  name: 'analyze_document',
  description: 'Analyze documents with vision and text understanding',
  inputModalities: ['image', 'text'],
  outputModalities: ['text', 'image'],

  execute: async ({ images, text }) => {
    // Vision analysis
    const visualAnalysis = await Promise.all(
      images.map(img => visionModel.analyze(img))
    );

    // Text extraction
    const extractedText = await ocr.extract(images);

    // Combined reasoning
    const analysis = await llm.complete({
      prompt: `Analyze this document:\n` +
              `Visual elements: ${JSON.stringify(visualAnalysis)}\n` +
              `Text content: ${extractedText}\n` +
              `User query: ${text}`
    });

    // Generate annotated image
    const annotatedImage = await annotateImage(images[0], visualAnalysis);

    return {
      text: analysis,
      images: [annotatedImage]
    };
  }
};

// Agent using unified tools
const agent = new MultimodalAgent({
  tools: [
    documentAnalysisTool,
    imageGenerationTool,
    audioTranscriptionTool,
    videoSummaryTool
  ]
});
```

---

## Production Systems & Case Studies

### Market Growth

**Agentic AI Market Projection**:
- **2030**: $78.2 billion
- **YoY Growth (2025)**: 127%
- **Trend**: Enterprise adoption accelerating

### Architecture Patterns for Production

#### Pattern 1: Self-Reflection Systems

```
┌──────────┐
│  Actor   │ → Generates actions
└──────────┘
     ↓
┌──────────┐
│ Evaluator│ → Assesses outcomes
└──────────┘
     ↓
┌────────────────┐
│ Self-Reflection│ → Generates improvement feedback
│     Module     │    Maintains episodic memory
└────────────────┘
     ↓
  (Iterate)
```

**Use Cases**:
- Code generation with iterative refinement
- Content creation with quality assessment
- Task execution with error recovery

#### Pattern 2: Tool-Use Architectures

**Modern Implementation**: Function calling with structured outputs

```typescript
// Production-grade tool calling
interface ToolCallSystem {
  tools: Tool[];
  model: LLM;
  structuredOutput: boolean;
  maxIterations: number;
}

const system: ToolCallSystem = {
  tools: [
    calculatorTool,
    searchTool,
    databaseTool,
    visionAnalysisTool,
    audioTranscriptionTool
  ],
  model: 'gpt-4o',
  structuredOutput: true, // Enforce schema validation
  maxIterations: 5
};

// Execution loop with multimodal support
async function executeWithTools(userInput: MultimodalInput) {
  let iteration = 0;
  let context = { text: userInput.text, images: userInput.images };

  while (iteration < system.maxIterations) {
    const response = await system.model.complete({
      messages: buildMessages(context),
      tools: system.tools,
      structuredOutput: system.structuredOutput
    });

    if (response.toolCalls) {
      const results = await executeTools(response.toolCalls);
      context = mergeContext(context, results);
      iteration++;
    } else {
      return response.content;
    }
  }
}
```

### Real-World Case Studies

#### Finance: Multimodal Trading Agent

**System**: Zhang et al. (2024) - Multimodal Foundation Agent for Financial Trading

**Architecture**:
```
Market Data (Text) ──┐
News Articles (Text) ─┤
Charts (Images) ──────┼→ Multimodal Fusion → Trading Decisions
Earnings Reports (PDF)┤
Social Sentiment ─────┘
```

**Capabilities**:
- Chart pattern recognition (vision)
- News sentiment analysis (text)
- Earnings report parsing (document understanding)
- Real-time decision making

#### Finance: Fincon - Conceptual Verbal Reinforcement

**Innovation**: Multi-agent system with reinforcement learning

**Agent Roles**:
- **Analyst Agent**: Process financial data (multimodal)
- **Risk Agent**: Assess portfolio risk
- **Execution Agent**: Execute trades
- **Reflection Agent**: Learn from outcomes

#### Healthcare: Radiology Annotation Agents

**Capabilities**:
- Image annotation (vision)
- Diagnostic suggestions (reasoning)
- Report generation (text)

**Models**: GPT-4o + specialized medical imaging tools

**Workflow**:
```
X-Ray/MRI/CT Image
     ↓
Vision Model (GPT-4o) → Detect anomalies
     ↓
Medical Knowledge Base → Context retrieval
     ↓
LLM Reasoning → Diagnostic suggestions
     ↓
Report Generation → Radiologist review
```

#### Autonomous Vehicles: Multi-Agent Traffic Optimization

**Architecture**: Distributed multi-agent system

**Agents**:
- **Vehicle Agents**: Individual self-driving cars
- **Infrastructure Agents**: Traffic lights, signs
- **Coordination Agent**: Optimize traffic flow

**Modalities**:
- **Vision**: Camera feeds, LiDAR
- **Sensor**: Speed, position, acceleration
- **Communication**: V2V (vehicle-to-vehicle), V2I (vehicle-to-infrastructure)

**Outcomes**:
- Reduced congestion
- Enhanced road safety
- Optimized traffic patterns

#### Customer Service: Multimodal Support Agents

**Deployment**: Major companies using Gemini Live and OpenAI Realtime

**Capabilities**:
- **Voice**: Natural conversation (Gemini Live)
- **Screen**: Understand user's screen (vision)
- **Camera**: See user's environment (vision)
- **Context**: Maintain conversation history

**Architecture (Modern Enterprise)**:

```typescript
interface MultimodalSupportAgent {
  // Input modalities
  voiceInput: GeminiLive | OpenAIRealtime;
  screenCapture: VisionModel;
  cameraFeed?: VisionModel;
  textInput: string;

  // Context management
  conversationMemory: ConversationHistory;
  userProfile: UserContext;
  productKnowledge: KnowledgeBase;

  // Tools
  tools: [
    searchKnowledgeBase,
    createTicket,
    scheduleCallback,
    processRefund,
    analyzeScreenshot // Vision tool
  ];

  // Orchestration
  async handleInteraction(input: MultimodalInput) {
    // 1. Process all modalities
    const voice = await this.voiceInput.process(input.audio);
    const screen = await this.screenCapture.analyze(input.screenshot);
    const context = this.conversationMemory.retrieve();

    // 2. Unified reasoning
    const response = await llm.reason({
      userSpeech: voice.transcript,
      userEmotion: voice.emotion, // From Gemini Live
      screenContext: screen.analysis,
      conversationHistory: context,
      availableTools: this.tools
    });

    // 3. Execute tools if needed
    if (response.toolCalls) {
      await this.executeTools(response.toolCalls);
    }

    // 4. Respond with appropriate modality
    return {
      audio: await tts.synthesize(response.text, {
        emotion: voice.emotion // Match user's emotional state
      }),
      text: response.text,
      screenAnnotations: response.annotations // Highlight UI elements
    };
  }
}
```

**Results**:
- Auto de-escalate stressful calls (emotion detection)
- Faster resolution (screen context understanding)
- Higher customer satisfaction

### Enterprise Deployment Patterns

#### Pattern 1: Modular Microservices

```
┌─────────────────┐
│  API Gateway    │ ← User requests
└─────────────────┘
         ↓
    ┌────┴────┐
    │ Router  │
    └────┬────┘
         ↓
    ┌────┴──────────────────────┐
    │                           │
┌───┴────┐  ┌────────┐  ┌──────┴───┐
│ Vision │  │ Audio  │  │   Text   │
│ Service│  │Service │  │ Service  │
└───┬────┘  └────┬───┘  └──────┬───┘
    │            │             │
    └────────────┴─────────────┘
                 ↓
         ┌───────────────┐
         │  Orchestrator │
         └───────────────┘
                 ↓
         ┌───────────────┐
         │   Response    │
         └───────────────┘
```

**Benefits**:
- Independent scaling
- Technology flexibility
- Failure isolation
- Easier testing

#### Pattern 2: Unified Native Multimodal

```
┌─────────────────────────────────┐
│  Native Multimodal Model        │
│  (e.g., Gemini 2.5, GPT-4o)     │
│                                 │
│  Audio → Shared Encoder → Output│
│  Vision→                        │
│  Text →                         │
└─────────────────────────────────┘
```

**Benefits**:
- Lower latency
- Simpler architecture
- Preserved cross-modal context
- Emotion/tone preservation

**Trade-offs**:
- Less model flexibility
- Newer pattern (less battle-tested)
- Vendor lock-in

### Production Checklist

**For Multimodal Agents**:

- [ ] Modality preprocessing (resize images, normalize audio)
- [ ] Rate limiting per modality
- [ ] Fallback strategies (vision fails → use text description)
- [ ] Cost monitoring (vision/audio more expensive than text)
- [ ] Streaming for long-running tasks
- [ ] Progress feedback (multimodal tasks take longer)
- [ ] Error handling per modality
- [ ] Security (PII in images/audio)
- [ ] Compliance (data retention policies)
- [ ] Monitoring (latency per modality, accuracy metrics)

---

## Benchmarks & Evaluation

### Desktop and GUI Automation

#### OSWorld

**Release**: NeurIPS 2024
**Type**: Full-fledged virtual computer environment

**Features**:
- Complete desktop simulation
- Multiple applications
- Realistic task scenarios

**Successor**: **OSUniverse** (mid-2025)
- More robust testing
- Broader app coverage
- Multi-platform capabilities

#### VisualAgentBench

**Purpose**: Unified benchmark for training and evaluating LMMs as generalist visual agents

**Domains**:

1. **Embodied Tasks**: Simulated environments (robotics, navigation)
2. **GUI Tasks**:
   - Mobile app interactions
   - Web browsing
   - Desktop automation
3. **Visual Design**:
   - CSS bug-fixing
   - Web design tasks
   - UI/UX modifications

**Evaluation Metric**: **Success Rate (SR)**

**Success Definition**:
- Achieve all predefined task goals
- Within fixed turn budget
- In interactive environments

**For Visual Design**:
- Use Structural Similarity (SSIM) between agent output and ground truth
- Threshold: SSIM > 0.9 for success

#### Vision-Centric Agentic Benchmarks

**Key Finding**: No current LM-based agent exceeds 50% success on complex, multi-step, tool-driven tasks.

**Recent Benchmarks**:
- **Agent-X**: Multi-step reasoning with tools
- **VisuLogic**: Visual logical reasoning
- **IQBench**: Interactive question answering
- **VideoReasonBench**: Video understanding and reasoning

### Vision-Language-Action Model Capabilities

**Core Foundational Capabilities** (must demonstrate):

1. **Visual Grounding**: Locate and identify visual elements
2. **Spatial Reasoning**: Understand spatial relationships
3. **Multi-Step Planning**: Plan action sequences
4. **Action Taking**:
   - Discrete actions (click, type)
   - Continuous actions (drag, scroll)
5. **Physical Commonsense Reasoning**: Understand real-world physics
6. **Function Calling**: Invoke tools appropriately
7. **Tool Use**: Leverage external capabilities

### Document Understanding Benchmarks

#### ViDoRe (Visual Document Retrieval)

**Components**:
- Page-level retrieval tasks
- Multiple domains (academic, technical, financial)
- Multiple languages
- Various practical settings

**Metrics**:
- nDCG@5 (Normalized Discounted Cumulative Gain)
- Recall@K
- Precision

**Top Performers**:
1. ColPali: 81.3 nDCG@5
2. BGE-M3: 75 nDCG@5
3. BM25: 65 nDCG@5

### Audio Benchmarks

#### MultiChallenge Audio Benchmark

**Focus**: Instruction following accuracy in audio conversations

**Results (2025)**:
- gpt-realtime: 30.5%
- Previous model (Dec 2024): 20.6%

**Challenge Areas**:
- Complex multi-turn instructions
- Ambiguous commands
- Noisy environments
- Accent variation

### Web Agent Benchmarks

#### WebVoyager Benchmark

**Scale**: 643 tasks across 15 real-world websites

**Task Categories**:
- Shopping (Amazon, Apple)
- Travel booking (Google Flights)
- Information retrieval (BBC News, Wikipedia)
- Account management
- Form filling

**Evaluation**: Automatic metric with 85.3% human agreement

**Top Results**:
- WebVoyager (multimodal): 59.1%
- GPT-4 (all tools): Lower (specific % not disclosed)
- WebVoyager (text-only): Lower
- SeeAct (best autonomous): 26%

#### VisualWebArena

**Focus**: Realistic visual web tasks

**Features**:
- Real websites (not synthetic)
- Multi-step interactions
- Visual understanding required
- Tool use evaluation

### GUI Grounding Benchmarks

#### ScreenSpot

**First realistic GUI grounding benchmark**

**Environments**:
- Mobile apps (iOS, Android)
- Desktop applications (Windows, macOS, Linux)
- Web interfaces

**Tasks**:
- Element localization
- Action prediction
- Screen understanding

**Correlation**: Strong correlation between GUI grounding accuracy and downstream agent performance.

### Evaluation Metrics Summary

| Benchmark | Metric | Best Score | Domain |
|-----------|--------|------------|--------|
| **WebVoyager** | Success Rate | 59.1% | Web automation |
| **VisualAgentBench** | Success Rate | <50% | Multi-domain |
| **ViDoRe** | nDCG@5 | 81.3% (ColPali) | Document retrieval |
| **MultiChallenge** | Instruction Accuracy | 30.5% | Audio agents |
| **ScreenSpot** | Grounding Accuracy | Varies | GUI interaction |

### Current Limitations

**Complex Visual Tasks** (still challenging):
- Intricate flowcharts
- Multi-layered technical diagrams
- Dense statistical charts with embedded sub-elements
- 3D visualizations
- Overlapping annotations

**Multi-Step Reasoning**:
- Success rates drop significantly for 5+ step tasks
- Tool coordination remains difficult
- Error recovery needs improvement

**Modality Gaps**:
- Audio understanding lags behind vision
- Video understanding still nascent
- Cross-modal reasoning underdeveloped

---

## Implementation Patterns

### Pattern 1: Multimodal Tool Loop (AI SDK v6)

```typescript
import { ToolLoopAgent } from '@ai-sdk/agent';
import { openai } from '@ai-sdk/openai';

const agent = new ToolLoopAgent({
  model: openai('gpt-4o'),

  tools: {
    // Vision tool
    analyzeImage: tool({
      description: 'Analyze images for objects, text, and context',
      inputSchema: z.object({
        imageUrl: z.string(),
        analysisType: z.enum(['objects', 'text', 'scene', 'comprehensive'])
      }),
      execute: async ({ imageUrl, analysisType }) => {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: `Analyze this image for: ${analysisType}` },
                { type: 'image_url', image_url: { url: imageUrl } }
              ]
            }
          ]
        });

        return { analysis: response.choices[0].message.content };
      }
    }),

    // Audio tool
    transcribeAudio: tool({
      description: 'Transcribe audio to text',
      inputSchema: z.object({
        audioUrl: z.string(),
        language: z.string().optional()
      }),
      execute: async ({ audioUrl, language }) => {
        const response = await openai.audio.transcriptions.create({
          file: await fetch(audioUrl).then(r => r.blob()),
          model: 'whisper-1',
          language
        });

        return { transcript: response.text };
      }
    }),

    // Document understanding tool
    analyzeDocument: tool({
      description: 'Extract and analyze information from PDF documents',
      inputSchema: z.object({
        documentUrl: z.string(),
        query: z.string()
      }),
      execute: async ({ documentUrl, query }) => {
        // 1. Convert PDF to images
        const pages = await pdfToImages(documentUrl);

        // 2. Use ColPali for retrieval
        const relevantPages = await colpaliRetriever.retrieve({
          query,
          pages,
          topK: 3
        });

        // 3. Analyze with vision model
        const analyses = await Promise.all(
          relevantPages.map(page =>
            analyzeImage.execute({
              imageUrl: page.imageUrl,
              analysisType: 'comprehensive'
            })
          )
        );

        return {
          relevantPages: relevantPages.map((p, i) => ({
            pageNumber: p.number,
            analysis: analyses[i].analysis
          }))
        };
      }
    }),

    // Image generation tool
    generateImage: tool({
      description: 'Generate images from text descriptions',
      inputSchema: z.object({
        prompt: z.string(),
        style: z.string().optional()
      }),
      execute: async ({ prompt, style }) => {
        const fullPrompt = style ? `${prompt}, style: ${style}` : prompt;

        const response = await openai.images.generate({
          model: 'dall-e-3',
          prompt: fullPrompt,
          n: 1,
          size: '1024x1024'
        });

        return { imageUrl: response.data[0].url };
      }
    })
  },

  maxSteps: 10
});

// Usage
const result = await agent.execute({
  prompt: 'Analyze the financial report at [url], extract key metrics, and create a visualization'
});
```

### Pattern 2: Streaming Multimodal Responses

```typescript
import { streamText } from 'ai';

async function* streamMultimodalResponse(
  userMessage: { text: string; images?: string[]; audio?: string }
) {
  const messages = [
    {
      role: 'user' as const,
      content: [
        { type: 'text', text: userMessage.text },
        ...(userMessage.images?.map(img => ({
          type: 'image_url' as const,
          image_url: { url: img }
        })) || [])
      ]
    }
  ];

  // Add audio transcription if present
  if (userMessage.audio) {
    const transcript = await transcribeAudio.execute({
      audioUrl: userMessage.audio
    });
    messages.push({
      role: 'user',
      content: `[Audio transcription]: ${transcript.transcript}`
    });
  }

  const stream = await streamText({
    model: openai('gpt-4o'),
    messages,
    tools: {
      analyzeImage,
      transcribeAudio,
      analyzeDocument,
      generateImage
    }
  });

  for await (const chunk of stream.textStream) {
    yield { type: 'text', content: chunk };
  }

  // Handle tool calls
  for await (const toolCall of stream.toolCalls) {
    yield { type: 'tool_call', toolCall };

    const result = await toolCall.execute();
    yield { type: 'tool_result', result };
  }
}

// Frontend usage
const stream = streamMultimodalResponse({
  text: 'Analyze this image and generate a similar one',
  images: ['https://example.com/image.jpg']
});

for await (const event of stream) {
  if (event.type === 'text') {
    updateUI(event.content);
  } else if (event.type === 'tool_call') {
    showToolExecution(event.toolCall.name);
  } else if (event.type === 'tool_result') {
    displayToolResult(event.result);
  }
}
```

### Pattern 3: Context Management for Multimodal Agents

```typescript
interface MultimodalContext {
  text: string[];
  images: { url: string; analysis?: string }[];
  audio: { url: string; transcript?: string }[];
  documents: { url: string; summary?: string }[];

  // Metadata
  timestamp: number;
  userId: string;
  sessionId: string;
}

class MultimodalMemory {
  private contexts: Map<string, MultimodalContext[]> = new Map();

  async addContext(
    sessionId: string,
    context: Partial<MultimodalContext>
  ): Promise<void> {
    const existing = this.contexts.get(sessionId) || [];

    // Enrich context with analysis
    const enriched: MultimodalContext = {
      text: context.text || [],
      images: await Promise.all(
        (context.images || []).map(async img => ({
          url: img.url,
          analysis: img.analysis || await this.analyzeImage(img.url)
        }))
      ),
      audio: await Promise.all(
        (context.audio || []).map(async aud => ({
          url: aud.url,
          transcript: aud.transcript || await this.transcribeAudio(aud.url)
        }))
      ),
      documents: await Promise.all(
        (context.documents || []).map(async doc => ({
          url: doc.url,
          summary: doc.summary || await this.summarizeDocument(doc.url)
        }))
      ),
      timestamp: Date.now(),
      userId: context.userId!,
      sessionId
    };

    existing.push(enriched);
    this.contexts.set(sessionId, existing);
  }

  async retrieve(sessionId: string, query?: string): Promise<MultimodalContext[]> {
    const contexts = this.contexts.get(sessionId) || [];

    if (!query) {
      return contexts.slice(-5); // Last 5 contexts
    }

    // Semantic search across all modalities
    const relevantContexts = await this.semanticSearch(contexts, query);
    return relevantContexts;
  }

  private async semanticSearch(
    contexts: MultimodalContext[],
    query: string
  ): Promise<MultimodalContext[]> {
    // Embed query
    const queryEmbedding = await this.embed(query);

    // Score each context
    const scored = await Promise.all(
      contexts.map(async ctx => {
        // Combine all text content
        const allText = [
          ...ctx.text,
          ...ctx.images.map(i => i.analysis || ''),
          ...ctx.audio.map(a => a.transcript || ''),
          ...ctx.documents.map(d => d.summary || '')
        ].join(' ');

        const contextEmbedding = await this.embed(allText);
        const similarity = this.cosineSimilarity(queryEmbedding, contextEmbedding);

        return { context: ctx, similarity };
      })
    );

    // Return top 5
    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .map(s => s.context);
  }

  private async analyzeImage(url: string): Promise<string> {
    // Use vision model
    return '...';
  }

  private async transcribeAudio(url: string): Promise<string> {
    // Use Whisper
    return '...';
  }

  private async summarizeDocument(url: string): Promise<string> {
    // Use ColPali + LLM
    return '...';
  }

  private async embed(text: string): Promise<number[]> {
    // Use embedding model
    return [];
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    // Calculate cosine similarity
    return 0;
  }
}

// Usage in agent
const memory = new MultimodalMemory();

async function processMultimodalRequest(request: {
  text: string;
  images?: string[];
  sessionId: string;
}) {
  // Add to memory
  await memory.addContext(request.sessionId, {
    text: [request.text],
    images: request.images?.map(url => ({ url })),
    userId: 'user-123',
    sessionId: request.sessionId
  });

  // Retrieve relevant context
  const context = await memory.retrieve(request.sessionId, request.text);

  // Use context in agent
  const response = await agent.execute({
    prompt: request.text,
    context: context.map(c => ({
      text: c.text.join(' '),
      images: c.images.map(i => i.analysis).join(' '),
      // ... other modalities
    }))
  });

  return response;
}
```

### Pattern 4: Vision Agent with Computer Use

```typescript
// Claude Computer Use pattern
import Anthropic from '@anthropic-ai/sdk';

class ComputerUseAgent {
  private client: Anthropic;
  private sessionId: string;

  constructor() {
    this.client = new Anthropic();
    this.sessionId = crypto.randomUUID();
  }

  async executeTask(task: string): Promise<void> {
    const messages: Anthropic.Messages.MessageParam[] = [
      { role: 'user', content: task }
    ];

    let continueLoop = true;

    while (continueLoop) {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages,
        tools: [
          {
            type: 'computer_20241022',
            name: 'computer',
            display_width_px: 1024,
            display_height_px: 768,
            display_number: 1
          },
          {
            type: 'text_editor_20241022',
            name: 'str_replace_editor'
          },
          {
            type: 'bash_20241022',
            name: 'bash'
          }
        ]
      });

      // Add assistant response to messages
      messages.push({ role: 'assistant', content: response.content });

      // Process tool uses
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await this.executeToolUse(block);

          messages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(result)
              }
            ]
          });
        } else if (block.type === 'text') {
          console.log('Claude:', block.text);

          if (this.isTaskComplete(block.text)) {
            continueLoop = false;
          }
        }
      }

      if (response.stop_reason === 'end_turn') {
        continueLoop = false;
      }
    }
  }

  private async executeToolUse(toolUse: any): Promise<any> {
    switch (toolUse.name) {
      case 'computer':
        return this.executeComputerAction(toolUse.input);
      case 'str_replace_editor':
        return this.executeEditorAction(toolUse.input);
      case 'bash':
        return this.executeBashCommand(toolUse.input);
      default:
        throw new Error(`Unknown tool: ${toolUse.name}`);
    }
  }

  private async executeComputerAction(input: {
    action: 'key' | 'type' | 'mouse_move' | 'left_click' | 'screenshot';
    coordinate?: [number, number];
    text?: string;
  }): Promise<{ success: boolean; screenshot?: string }> {
    // Take screenshot before action
    const beforeScreenshot = await this.takeScreenshot();

    // Execute action (using Xvfb, Playwright, or similar)
    switch (input.action) {
      case 'screenshot':
        return { success: true, screenshot: beforeScreenshot };

      case 'mouse_move':
        await this.moveMouse(input.coordinate!);
        break;

      case 'left_click':
        await this.click(input.coordinate!);
        break;

      case 'type':
        await this.type(input.text!);
        break;

      case 'key':
        await this.pressKey(input.text!);
        break;
    }

    // Take screenshot after action
    const afterScreenshot = await this.takeScreenshot();

    return { success: true, screenshot: afterScreenshot };
  }

  private async executeEditorAction(input: any): Promise<any> {
    // Implement text editor actions
    return { success: true };
  }

  private async executeBashCommand(input: { command: string }): Promise<any> {
    // Execute bash command in sandboxed environment
    return { success: true, output: '...' };
  }

  private async takeScreenshot(): Promise<string> {
    // Capture screenshot and return base64
    return 'data:image/png;base64,...';
  }

  private async moveMouse(coord: [number, number]): Promise<void> {
    // Move mouse to coordinate
  }

  private async click(coord: [number, number]): Promise<void> {
    // Click at coordinate
  }

  private async type(text: string): Promise<void> {
    // Type text
  }

  private async pressKey(key: string): Promise<void> {
    // Press key
  }

  private isTaskComplete(text: string): boolean {
    // Determine if task is complete based on Claude's response
    return text.includes('Task completed') || text.includes('Done');
  }
}

// Usage
const agent = new ComputerUseAgent();
await agent.executeTask('Open Firefox and search for "multimodal AI agents"');
```

### Pattern 5: Gemini Live Real-Time Voice Agent

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

class GeminiLiveAgent {
  private client: GoogleGenerativeAI;
  private session: any;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async startLiveSession(tools: Tool[]): Promise<void> {
    const model = this.client.getGenerativeModel({
      model: 'gemini-2.5-flash',
    });

    this.session = await model.startChat({
      tools: tools.map(t => ({
        functionDeclarations: [{
          name: t.name,
          description: t.description,
          parameters: t.inputSchema
        }]
      })),
      generationConfig: {
        temperature: 0.7,
      }
    });

    // Handle audio input stream
    const audioStream = await this.captureAudio();

    for await (const audioChunk of audioStream) {
      // Send audio to Gemini Live
      const response = await this.session.sendMessage({
        inlineData: {
          mimeType: 'audio/wav',
          data: audioChunk
        }
      });

      // Process response
      for (const candidate of response.candidates) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            // Text response - convert to speech
            await this.playAudio(await this.textToSpeech(part.text));
          } else if (part.functionCall) {
            // Tool call - execute and send result
            const result = await this.executeFunction(
              part.functionCall.name,
              part.functionCall.args
            );

            await this.session.sendMessage({
              functionResponse: {
                name: part.functionCall.name,
                response: result
              }
            });
          } else if (part.inlineData?.mimeType.startsWith('audio/')) {
            // Audio response - play directly
            await this.playAudio(part.inlineData.data);
          }
        }
      }
    }
  }

  private async captureAudio(): AsyncIterable<Buffer> {
    // Capture audio from microphone in chunks
    // Yield chunks as they become available
    yield Buffer.from([]);
  }

  private async textToSpeech(text: string): Promise<Buffer> {
    // Convert text to speech (if not using native audio output)
    return Buffer.from([]);
  }

  private async playAudio(audio: Buffer | string): Promise<void> {
    // Play audio through speakers
  }

  private async executeFunction(name: string, args: any): Promise<any> {
    // Execute tool function
    return {};
  }
}

// Usage
const agent = new GeminiLiveAgent(process.env.GOOGLE_API_KEY);

await agent.startLiveSession([
  {
    name: 'search_web',
    description: 'Search the web for information',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      }
    }
  },
  {
    name: 'get_weather',
    description: 'Get current weather for a location',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string' }
      }
    }
  }
]);
```

---

## Code Examples

### Example 1: Multimodal Document Q&A

```typescript
import { createAgent } from '@ai-sdk/agent';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Document Q&A agent with vision + text
const documentAgent = createAgent({
  model: openai('gpt-4o'),

  tools: {
    loadDocument: tool({
      description: 'Load and analyze a document (PDF, image, etc.)',
      inputSchema: z.object({
        documentUrl: z.string(),
        documentType: z.enum(['pdf', 'image', 'webpage'])
      }),
      execute: async ({ documentUrl, documentType }) => {
        if (documentType === 'pdf') {
          // Convert PDF to images
          const pages = await pdfToImages(documentUrl);

          // Use ColPali for embedding
          const embeddings = await colpali.embed(pages);

          // Store in vector DB
          await vectorDb.store({
            id: documentUrl,
            embeddings,
            metadata: { type: 'pdf', pages: pages.length }
          });

          return {
            success: true,
            pageCount: pages.length,
            message: `Loaded ${pages.length} pages from PDF`
          };
        } else if (documentType === 'image') {
          // Analyze image directly
          const analysis = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Describe this document in detail' },
                  { type: 'image_url', image_url: { url: documentUrl } }
                ]
              }
            ]
          });

          return {
            success: true,
            analysis: analysis.choices[0].message.content
          };
        }
      }
    }),

    queryDocument: tool({
      description: 'Answer questions about loaded documents',
      inputSchema: z.object({
        documentUrl: z.string(),
        question: z.string()
      }),
      execute: async ({ documentUrl, question }) => {
        // Retrieve relevant pages
        const relevantPages = await vectorDb.search({
          id: documentUrl,
          query: question,
          topK: 3
        });

        // Analyze each page with the question
        const analyses = await Promise.all(
          relevantPages.map(page =>
            openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: question },
                    { type: 'image_url', image_url: { url: page.imageUrl } }
                  ]
                }
              ]
            })
          )
        );

        // Synthesize answers
        const synthesis = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'Synthesize these answers into a coherent response'
            },
            {
              role: 'user',
              content: analyses.map((a, i) =>
                `Page ${relevantPages[i].pageNumber}: ${a.choices[0].message.content}`
              ).join('\n\n')
            }
          ]
        });

        return {
          answer: synthesis.choices[0].message.content,
          sources: relevantPages.map(p => ({
            page: p.pageNumber,
            url: p.imageUrl
          }))
        };
      }
    })
  }
});

// Usage
const result = await documentAgent.execute({
  prompt: 'Load the financial report at https://example.com/report.pdf and tell me what the revenue was in Q4'
});
```

### Example 2: Vision + Voice Customer Support

```typescript
import { GeminiLiveAgent } from './gemini-live';
import { VisionAgent } from './vision-agent';

class MultimodalSupportAgent {
  private voiceAgent: GeminiLiveAgent;
  private visionAgent: VisionAgent;
  private conversationHistory: any[] = [];

  async handleSupportRequest(request: {
    audio?: Buffer;
    screenshot?: string;
    text?: string;
  }): Promise<{
    audioResponse?: Buffer;
    textResponse: string;
    screenAnnotations?: any[];
  }> {
    // 1. Process audio if present
    let userMessage = request.text || '';
    let userEmotion = null;

    if (request.audio) {
      const audioAnalysis = await this.voiceAgent.analyzeAudio(request.audio);
      userMessage = audioAnalysis.transcript;
      userEmotion = audioAnalysis.emotion; // Gemini Live detects emotion
    }

    // 2. Analyze screenshot if present
    let screenContext = null;
    if (request.screenshot) {
      screenContext = await this.visionAgent.analyzeScreen({
        screenshot: request.screenshot,
        task: 'identify-issue'
      });
    }

    // 3. Construct multimodal context
    const context = {
      userMessage,
      userEmotion,
      screenContext,
      conversationHistory: this.conversationHistory
    };

    // 4. Reason about the support request
    const response = await this.reasonAboutRequest(context);

    // 5. Generate appropriate responses
    const result = {
      textResponse: response.text,
      audioResponse: await this.generateAudioResponse(response.text, userEmotion),
      screenAnnotations: response.screenActions
    };

    // 6. Update conversation history
    this.conversationHistory.push({
      user: { message: userMessage, emotion: userEmotion },
      assistant: response,
      timestamp: Date.now()
    });

    return result;
  }

  private async reasonAboutRequest(context: any): Promise<any> {
    const prompt = this.buildPrompt(context);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful customer support agent. Analyze the user\'s issue and provide clear guidance.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'annotate_screen',
            description: 'Highlight UI elements on the user\'s screen',
            parameters: {
              type: 'object',
              properties: {
                elements: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      description: { type: 'string' },
                      coordinates: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'search_knowledge_base',
            description: 'Search internal knowledge base',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string' }
              }
            }
          }
        }
      ]
    });

    return this.processResponse(response);
  }

  private buildPrompt(context: any): string {
    let prompt = `User Message: ${context.userMessage}\n`;

    if (context.userEmotion) {
      prompt += `User Emotion: ${context.userEmotion} (adjust tone accordingly)\n`;
    }

    if (context.screenContext) {
      prompt += `\nScreen Analysis:\n${JSON.stringify(context.screenContext, null, 2)}\n`;
    }

    if (context.conversationHistory.length > 0) {
      prompt += `\nConversation History:\n`;
      prompt += context.conversationHistory
        .slice(-3) // Last 3 exchanges
        .map((h: any) => `User: ${h.user.message}\nAssistant: ${h.assistant.text}`)
        .join('\n\n');
    }

    return prompt;
  }

  private async generateAudioResponse(
    text: string,
    userEmotion: string | null
  ): Promise<Buffer> {
    // Match user's emotional state for more empathetic responses
    const voice = this.selectVoiceForEmotion(userEmotion);

    const audio = await openai.audio.speech.create({
      model: 'tts-1',
      voice,
      input: text
    });

    return Buffer.from(await audio.arrayBuffer());
  }

  private selectVoiceForEmotion(emotion: string | null): string {
    // Select appropriate voice based on emotion
    if (emotion === 'frustrated' || emotion === 'angry') {
      return 'nova'; // Calming voice
    } else if (emotion === 'happy') {
      return 'alloy'; // Upbeat voice
    }
    return 'echo'; // Default
  }

  private processResponse(response: any): any {
    // Process tool calls and extract response
    return {
      text: response.choices[0].message.content,
      screenActions: [] // Extract from tool calls
    };
  }
}

// Usage
const agent = new MultimodalSupportAgent();

const result = await agent.handleSupportRequest({
  audio: audioBuffer,
  screenshot: 'data:image/png;base64,...',
  text: 'I can\'t find the export button'
});

// Play audio response
playAudio(result.audioResponse);

// Display text
console.log(result.textResponse);

// Highlight UI elements
highlightElements(result.screenAnnotations);
```

### Example 3: WebVoyager-Style Browser Agent

```typescript
import { Page } from 'playwright';
import { openai } from '@ai-sdk/openai';

class BrowserVisionAgent {
  private page: Page;

  async navigate(task: string): Promise<void> {
    let completed = false;
    let attempts = 0;
    const maxAttempts = 20;

    while (!completed && attempts < maxAttempts) {
      // 1. Take screenshot
      const screenshot = await this.page.screenshot({ type: 'png' });

      // 2. Extract page text (for hybrid approach)
      const pageText = await this.page.evaluate(() => document.body.innerText);

      // 3. Annotate interactable elements
      const elements = await this.annotateElements();

      // 4. Ask vision model for next action
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a web navigation agent. Analyze the screenshot and decide the next action to complete the task.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Task: ${task}\n\n` +
                      `Available elements:\n${JSON.stringify(elements, null, 2)}\n\n` +
                      `Page text (for context):\n${pageText.slice(0, 1000)}...`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${screenshot.toString('base64')}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'click_element',
              description: 'Click on an element',
              parameters: {
                type: 'object',
                properties: {
                  elementId: { type: 'string', description: 'ID of element to click' }
                },
                required: ['elementId']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'type_text',
              description: 'Type text into an input field',
              parameters: {
                type: 'object',
                properties: {
                  elementId: { type: 'string' },
                  text: { type: 'string' }
                },
                required: ['elementId', 'text']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'scroll',
              description: 'Scroll the page',
              parameters: {
                type: 'object',
                properties: {
                  direction: { type: 'string', enum: ['up', 'down'] }
                },
                required: ['direction']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'task_complete',
              description: 'Mark the task as complete',
              parameters: { type: 'object', properties: {} }
            }
          }
        ]
      });

      // 5. Execute action
      const toolCall = response.choices[0].message.tool_calls?.[0];

      if (toolCall) {
        const args = JSON.parse(toolCall.function.arguments);

        switch (toolCall.function.name) {
          case 'click_element':
            await this.clickElement(args.elementId);
            break;

          case 'type_text':
            await this.typeText(args.elementId, args.text);
            break;

          case 'scroll':
            await this.scroll(args.direction);
            break;

          case 'task_complete':
            completed = true;
            break;
        }
      }

      attempts++;

      // Wait for page to update
      await this.page.waitForTimeout(1000);
    }
  }

  private async annotateElements(): Promise<any[]> {
    // Inject JavaScript to annotate all interactable elements
    return await this.page.evaluate(() => {
      const elements: any[] = [];

      // Find all clickable elements
      const clickable = document.querySelectorAll('a, button, input, select, textarea, [role="button"]');

      clickable.forEach((el, index) => {
        const id = `element-${index}`;
        el.setAttribute('data-agent-id', id);

        const rect = el.getBoundingClientRect();

        // Draw bounding box
        const box = document.createElement('div');
        box.style.position = 'absolute';
        box.style.left = `${rect.left}px`;
        box.style.top = `${rect.top}px`;
        box.style.width = `${rect.width}px`;
        box.style.height = `${rect.height}px`;
        box.style.border = '2px solid red';
        box.style.zIndex = '10000';
        box.style.pointerEvents = 'none';
        document.body.appendChild(box);

        // Add label
        const label = document.createElement('div');
        label.style.position = 'absolute';
        label.style.left = `${rect.left}px`;
        label.style.top = `${rect.top - 20}px`;
        label.style.background = 'red';
        label.style.color = 'white';
        label.style.padding = '2px 5px';
        label.style.fontSize = '12px';
        label.style.zIndex = '10001';
        label.textContent = index.toString();
        document.body.appendChild(label);

        elements.push({
          id,
          index,
          type: el.tagName.toLowerCase(),
          text: (el as HTMLElement).innerText?.slice(0, 50) || '',
          placeholder: (el as HTMLInputElement).placeholder || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          position: { x: rect.left, y: rect.top }
        });
      });

      return elements;
    });
  }

  private async clickElement(elementId: string): Promise<void> {
    await this.page.click(`[data-agent-id="${elementId}"]`);
  }

  private async typeText(elementId: string, text: string): Promise<void> {
    await this.page.fill(`[data-agent-id="${elementId}"]`, text);
  }

  private async scroll(direction: 'up' | 'down'): Promise<void> {
    await this.page.evaluate((dir) => {
      window.scrollBy(0, dir === 'down' ? 500 : -500);
    }, direction);
  }
}

// Usage
const browser = await playwright.chromium.launch();
const page = await browser.newPage();
await page.goto('https://amazon.com');

const agent = new BrowserVisionAgent();
await agent.navigate('Search for "wireless headphones" and add the first result to cart');
```

---

## Sources

### Vision + Language Agents
- [ChatGPT vs Claude vs Gemini: The Best AI Model for Each Use Case in 2025](https://creatoreconomy.so/p/chatgpt-vs-claude-vs-gemini-the-best-ai-model-for-each-use-case-2025)
- [GPT-4 Vision vs Gemini vs Claude: Which Multimodal LLM Wins in 2025?](https://qvision.space/blog/gpt-4-vision-vs-gemini-vs-claude-which-multimodal-llm-wins-in-2025)
- [Multimodal Large Language Models: Transforming Computer Vision](https://www.edge-ai-vision.com/2025/01/multimodal-large-language-models-transforming-computer-vision/)

### Claude Computer Use
- [Computer use tool - Claude Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)
- [Introducing computer use, a new Claude 3.5 Sonnet](https://www.anthropic.com/news/3-5-models-and-computer-use)
- [Anthropic's Claude 3.5 Computer Use Framework (AI Agent)](https://cobusgreyling.medium.com/anthropics-claude-3-5-computer-use-framework-ai-agent-6b3c48dac410)
- [Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)

### WebVoyager & Vision Agents
- [WebVoyager: Building an End-to-End Web Agent with Large Multimodal Models](https://arxiv.org/html/2401.13919v3)
- [State-of-the-Art Autonomous Web Agents (2024–2025)](https://medium.com/@learning_37638/state-of-the-art-autonomous-web-agents-2024-2025-3d9d93a5dde2)
- [SeeClick: Harnessing GUI Grounding for Advanced Visual GUI Agents](https://arxiv.org/html/2401.10935v1)
- [OSCAR: Operating System Control via State-Aware Reasoning and Re-Planning](https://arxiv.org/html/2410.18963v1)

### Set-of-Mark Prompting
- [Set-of-Mark Prompting Unleashes Extraordinary Visual Grounding in GPT-4V](https://arxiv.org/abs/2310.11441)
- [Navigating the Digital World as Humans Do: Universal Visual Grounding for GUI Agents](https://arxiv.org/html/2410.05243v1)

### Real-Time Voice Agents
- [Introducing gpt-realtime and Realtime API updates for production voice agents](https://openai.com/index/introducing-gpt-realtime/)
- [Get started with Live API | Gemini API](https://ai.google.dev/gemini-api/docs/live)
- [Gemini Live API available on Vertex AI](https://cloud.google.com/blog/products/ai-machine-learning/gemini-live-api-available-on-vertex-ai)
- [How to use Gemini Live API Native Audio in Vertex AI](https://cloud.google.com/blog/topics/developers-practitioners/how-to-use-gemini-live-api-native-audio-in-vertex-ai)

### Whisper
- [Introducing Whisper | OpenAI](https://openai.com/index/whisper/)
- [GitHub - openai/whisper](https://github.com/openai/whisper)
- [The Whisper model from OpenAI - Microsoft Learn](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/whisper-overview)

### Multimodal RAG
- [Multimodal RAG for PDFs with Text, Images, and Charts | Pathway](https://pathway.com/developers/templates/rag/multimodal-rag/)
- [An Easy Introduction to Multimodal Retrieval-Augmented Generation | NVIDIA](https://developer.nvidia.com/blog/an-easy-introduction-to-multimodal-retrieval-augmented-generation/)
- [Multi-Modal RAG: A Practical Guide](https://gautam75.medium.com/multi-modal-rag-a-practical-guide-99b0178c4fbb)
- [Vision-Guided Chunking Is All You Need](https://arxiv.org/html/2506.16035v1)

### ColPali
- [ColPali: Efficient Document Retrieval with Vision Language Models](https://huggingface.co/blog/manu/colpali)
- [ColPali: Efficient Document Retrieval with Vision Language Models](https://arxiv.org/html/2407.01449v2)
- [PDF Retrieval with Vision Language Models | Vespa Blog](https://blog.vespa.ai/retrieval-with-vision-language-models-colpali/)
- [GitHub - illuin-tech/colpali](https://github.com/illuin-tech/colpali)

### Image Generation
- [Best Image Generation Model in 2024? Flux, Dalle3, Midjourney, Stable Diffusion](https://medium.com/@boredgeeksociety/best-image-generation-model-in-2024-flux-dalle3-midjourney-stable-diffusion-or-adobe-firefly-2ed6173b4c16)
- [Comparing AI Image Generation Tools: DALL-E vs Midjourney vs Stable Diffusion vs FLUX.1](https://medium.com/@niall.mcnulty/comparing-ai-image-generation-tools-dall-e-vs-midjourney-vs-stable-diffusion-vs-flux-1-b394f95d36c4)

### AI SDK
- [AI SDK by Vercel](https://ai-sdk.dev/docs/introduction)
- [AI SDK 6 - Vercel](https://vercel.com/blog/ai-sdk-6)
- [How to build unified AI interfaces using the Vercel AI SDK](https://blog.logrocket.com/unified-ai-interfaces-vercel-sdk/)

### Unified Multimodal Tool Design
- [Building Multimodal AI Agents That See, Read, and Talk](https://www.gocodeo.com/post/building-multimodal-ai-agents-that-see-read-and-talk)
- [Multimodal AI Agents: Text, Vision, and Speech in Action](https://onereach.ai/blog/multimodal-ai-agents-enterprise-guide/)
- [The Rise of Multimodal AI Agents: Building Vision, Voice & Text Systems](https://getstream.io/blog/multimodal-ai-agents/)

### Production Systems
- [Agentic AI Design Patterns: Choosing the Right Multimodal & Multi-Agent Architecture (2022–2025)](https://medium.com/@balarampanda.ai/agentic-ai-design-patterns-choosing-the-right-multimodal-multi-agent-architecture-2022-2025-046a37eb6dbe)
- [Multi-Agent AI Systems in 2025: Key Insights, Use Cases & Future Trends](https://terralogic.com/multi-agent-ai-systems-why-they-matter-2025/)
- [2025 Multimodal AI Agents: Architecture & Trends](https://kanerika.com/blogs/multimodal-ai-agents/)

### Benchmarks
- [Best AI Agent Evaluation Benchmarks: 2025 Complete Guide](https://o-mega.ai/articles/the-best-ai-agent-evals-and-benchmarks-full-2025-guide)
- [VisualAgentBench: Multimodal Agent Benchmark](https://www.emergentmind.com/topics/visualagentbench)
- [Vision-Centric Benchmarks](https://www.emergentmind.com/topics/vision-centric-benchmarks)

### GPT-4o Vision
- [Using GPT4 Vision with Function Calling | OpenAI Cookbook](https://cookbook.openai.com/examples/multimodal/using_gpt4_vision_with_function_calling)
- [Hello GPT-4o | OpenAI](https://openai.com/index/hello-gpt-4o/)
- [GPT-4 Vision: A Comprehensive Guide for Beginners | DataCamp](https://www.datacamp.com/tutorial/gpt-4-vision-comprehensive-guide)

---

**Document Length:** ~17,000 tokens
**Last Updated:** January 5, 2026
**Framework Focus:** AI SDK v6, TypeScript, Production-Ready Patterns
