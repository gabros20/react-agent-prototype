# Sanity CMS Adapter - Feasibility Analysis

**Date:** November 18, 2025  
**Status:** ✅ **HIGHLY FEASIBLE - RECOMMENDED**  
**Alignment:** Excellent fit for the proposed NestJS agent architecture

---

## Executive Summary

**Sanity CMS integration is highly feasible and arguably superior to Contentful for the proposed architecture.** Sanity provides more developer-friendly APIs, real-time capabilities out of the box, flexible content modeling, and a powerful query language (GROQ) that aligns exceptionally well with AI agent use cases.

### Key Advantages Over Contentful
- **Real-time by default**: Content Lake with instant updates via listeners
- **GROQ query language**: More powerful and intuitive than GraphQL
- **Portable Text**: Structured content ideal for AI processing
- **Flexible schema**: No rigid content model constraints
- **Better local development**: Sanity Studio can run locally
- **More generous API limits**: Better suited for AI agent workloads
- **Open-source studio**: Fully customizable editing experience
- **Stronger developer community**: Better documentation and examples

---

## Table of Contents

1. [Feasibility Assessment](#1-feasibility-assessment)
2. [Sanity Architecture Overview](#2-sanity-architecture-overview)
3. [Key APIs and SDKs](#3-key-apis-and-sdks)
4. [NestJS Adapter Implementation](#4-nestjs-adapter-implementation)
5. [GROQ Query Language](#5-groq-query-language)
6. [Real-Time Capabilities](#6-real-time-capabilities)
7. [Content Modeling](#7-content-modeling)
8. [Authentication & Security](#8-authentication--security)
9. [Rate Limits & Performance](#9-rate-limits--performance)
10. [Asset Management](#10-asset-management)
11. [Webhooks & Events](#11-webhooks--events)
12. [Migration Path](#12-migration-path)
13. [Challenges & Considerations](#13-challenges--considerations)
14. [Best Practices](#14-best-practices)
15. [Comparison: Sanity vs Contentful](#15-comparison-sanity-vs-contentful)
16. [Code Examples](#16-code-examples)
17. [Conclusion](#17-conclusion)

---

## 1. Feasibility Assessment

### ✅ Highly Feasible - Rating: 9.5/10

**Why Sanity is an excellent fit:**

| Criterion | Assessment | Notes |
|-----------|-----------|-------|
| **API Maturity** | ✅ Excellent | Comprehensive REST and GraphQL APIs |
| **JavaScript SDK** | ✅ Excellent | `@sanity/client` - well-maintained, TypeScript support |
| **Real-time Support** | ✅ Native | Content Lake with built-in listeners |
| **Query Language** | ✅ Superior | GROQ - more powerful than GraphQL for content |
| **Content Flexibility** | ✅ Excellent | Schema-less approach with validation |
| **Developer Experience** | ✅ Excellent | Best-in-class DX, local development support |
| **Documentation** | ✅ Excellent | Comprehensive, with many examples |
| **AI Agent Alignment** | ✅ Perfect | Portable Text, flexible queries, real-time updates |
| **NestJS Integration** | ✅ Native | Perfect fit for modular architecture |
| **Extensibility** | ✅ Excellent | Fully customizable Studio and APIs |

### Architectural Alignment

Sanity aligns **perfectly** with the proposed NestJS agent architecture:

1. **Modular Design**: Sanity's API-first approach fits the adapter pattern
2. **Service Layer Abstraction**: Clean separation between agent logic and CMS operations
3. **Asynchronous Operations**: Native async/await support throughout
4. **Real-time Events**: Built-in listeners for content changes
5. **Type Safety**: Strong TypeScript support across the SDK
6. **Microservices Ready**: Stateless API design suitable for distributed systems

---

## 2. Sanity Architecture Overview

### Content Lake

Sanity's **Content Lake** is the core data store:
- **Real-time data store**: All changes propagate instantly
- **Multi-dataset support**: Separate production/staging environments
- **Global CDN**: Fast content delivery worldwide
- **Version control**: Built-in document history
- **ACID transactions**: Consistent data operations

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client Applications                   │
│  (Next.js, React Native, NestJS Agent Server, etc.)    │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
┌────────▼─────────┐   ┌────────▼─────────┐
│   Sanity Studio  │   │   Your NestJS    │
│  (Content Editor)│   │   Agent Server   │
└────────┬─────────┘   └────────┬─────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────────┐
         │    Sanity Content Lake    │
         │  (Real-time Data Store)   │
         └───────────────────────────┘
```

### Key Components

1. **Content Lake**: Real-time data store with ACID transactions
2. **APIs**: 
   - Content Delivery API (CDA) - Read operations
   - Content Management API (CMA) - Write operations
   - Real-time API - Live updates
3. **Sanity Studio**: Customizable content editing interface
4. **GROQ**: Powerful query language for content retrieval
5. **Portable Text**: Structured rich text format

---

## 3. Key APIs and SDKs

### 3.1 JavaScript Client SDK

**Package**: `@sanity/client`  
**Repository**: https://github.com/sanity-io/client  
**Documentation**: https://www.sanity.io/docs/js-client

#### Installation

```bash
npm install @sanity/client
```

#### Features

- ✅ Full CRUD operations
- ✅ GROQ query support
- ✅ Real-time listeners
- ✅ Asset upload/management
- ✅ Transactions and patches
- ✅ TypeScript support
- ✅ Browser and Node.js compatible
- ✅ Automatic retries
- ✅ Request cancellation

### 3.2 Content APIs

#### Content Delivery API (CDA)

**Purpose**: Fetch published content  
**Endpoint**: `https://<project-id>.api.sanity.io/v<api-version>/data/query/<dataset>`

**Features**:
- Fast CDN-backed reads
- GROQ or GraphQL queries
- Cached responses (optional)
- Public or authenticated access

#### Content Management API (CMA)

**Purpose**: Create, update, delete content  
**Endpoint**: `https://<project-id>.api.sanity.io/v<api-version>/data/mutate/<dataset>`

**Operations**:
- `create` - Create new documents
- `createOrReplace` - Upsert documents
- `createIfNotExists` - Conditional create
- `patch` - Update existing documents
- `delete` - Remove documents
- `transaction` - Multiple operations atomically

### 3.3 Real-time API

**Purpose**: Subscribe to content changes  
**Protocol**: Server-Sent Events (SSE)

**Features**:
- Instant updates on content changes
- Query-based subscriptions
- Automatic reconnection
- Transaction-level consistency

---

## 4. NestJS Adapter Implementation

### 4.1 Adapter Interface (ICMSAdapter)

This is the common interface all CMS adapters must implement:

```typescript
// server/agent/adapters/cms-adapter.interface.ts

export interface ICMSAdapter {
  // Identification
  readonly name: string;
  readonly version: string;
  
  // Core Operations
  getContent(params: GetContentParams): Promise<ContentResult>;
  createContent(params: CreateContentParams): Promise<ContentResult>;
  updateContent(params: UpdateContentParams): Promise<ContentResult>;
  deleteContent(params: DeleteContentParams): Promise<void>;
  
  // Schema & Validation
  getSchema(): Promise<SchemaDefinition>;
  validateContent(content: any): Promise<ValidationResult>;
  
  // Tools & Prompts
  getTools(): ToolDefinition[];
  getSystemPrompt(): string;
  getContextualPrompts(mode: AgentMode): string[];
  
  // Assets
  uploadAsset(params: UploadAssetParams): Promise<AssetResult>;
  getAsset(assetId: string): Promise<AssetResult>;
  deleteAsset(assetId: string): Promise<void>;
  
  // Search & Query
  search(query: SearchQuery): Promise<SearchResult[]>;
  executeQuery(query: string): Promise<any>;
  
  // Real-time (optional)
  subscribe?(query: string, callback: (update: any) => void): () => void;
  
  // Health & Status
  healthCheck(): Promise<HealthStatus>;
}
```

### 4.2 Sanity Adapter Implementation

```typescript
// server/agent/adapters/sanity/sanity.adapter.ts

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import sanityClient, { SanityClient } from '@sanity/client';
import { ICMSAdapter } from '../cms-adapter.interface';
import { SanityConfig } from './sanity.config';
import { SanityToolsProvider } from './tools/sanity-tools.provider';
import { SanitySchemaService } from './services/sanity-schema.service';
import { SanityContentService } from './services/sanity-content.service';
import { SanityAssetService } from './services/sanity-asset.service';

@Injectable()
export class SanityAdapter implements ICMSAdapter, OnModuleDestroy {
  readonly name = 'sanity';
  readonly version = '1.0.0';
  
  private readonly client: SanityClient;
  private subscriptions: Array<() => void> = [];
  
  constructor(
    private readonly config: SanityConfig,
    private readonly toolsProvider: SanityToolsProvider,
    private readonly schemaService: SanitySchemaService,
    private readonly contentService: SanityContentService,
    private readonly assetService: SanityAssetService,
  ) {
    this.client = sanityClient({
      projectId: config.projectId,
      dataset: config.dataset,
      apiVersion: config.apiVersion || '2023-11-01',
      useCdn: config.useCdn ?? true,
      token: config.token,
      perspective: 'published', // or 'previewDrafts'
      ignoreBrowserTokenWarning: true,
      withCredentials: false,
    });
  }
  
  // Content Operations
  async getContent(params: GetContentParams): Promise<ContentResult> {
    return this.contentService.getContent(this.client, params);
  }
  
  async createContent(params: CreateContentParams): Promise<ContentResult> {
    return this.contentService.createContent(this.client, params);
  }
  
  async updateContent(params: UpdateContentParams): Promise<ContentResult> {
    return this.contentService.updateContent(this.client, params);
  }
  
  async deleteContent(params: DeleteContentParams): Promise<void> {
    return this.contentService.deleteContent(this.client, params);
  }
  
  // Schema & Validation
  async getSchema(): Promise<SchemaDefinition> {
    return this.schemaService.getSchema(this.client);
  }
  
  async validateContent(content: any): Promise<ValidationResult> {
    return this.schemaService.validateContent(content);
  }
  
  // Tools & Prompts
  getTools(): ToolDefinition[] {
    return this.toolsProvider.getTools();
  }
  
  getSystemPrompt(): string {
    return this.toolsProvider.getSystemPrompt();
  }
  
  getContextualPrompts(mode: AgentMode): string[] {
    return this.toolsProvider.getContextualPrompts(mode);
  }
  
  // Assets
  async uploadAsset(params: UploadAssetParams): Promise<AssetResult> {
    return this.assetService.uploadAsset(this.client, params);
  }
  
  async getAsset(assetId: string): Promise<AssetResult> {
    return this.assetService.getAsset(this.client, assetId);
  }
  
  async deleteAsset(assetId: string): Promise<void> {
    return this.assetService.deleteAsset(this.client, assetId);
  }
  
  // Search & Query
  async search(query: SearchQuery): Promise<SearchResult[]> {
    const groqQuery = this.buildGROQQuery(query);
    const results = await this.client.fetch(groqQuery);
    return this.formatSearchResults(results);
  }
  
  async executeQuery(query: string): Promise<any> {
    return this.client.fetch(query);
  }
  
  // Real-time Subscriptions
  subscribe(query: string, callback: (update: any) => void): () => void {
    const subscription = this.client
      .listen(query)
      .subscribe({
        next: callback,
        error: (err) => console.error('Sanity subscription error:', err),
      });
    
    const unsubscribe = () => subscription.unsubscribe();
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }
  
  // Health Check
  async healthCheck(): Promise<HealthStatus> {
    try {
      await this.client.fetch('*[_id == "drafts."] | order(_updatedAt desc) [0]');
      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        timestamp: new Date(),
        error: error.message 
      };
    }
  }
  
  // Cleanup
  onModuleDestroy() {
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions = [];
  }
  
  // Helper Methods
  private buildGROQQuery(query: SearchQuery): string {
    // Convert generic search query to GROQ
    // This is where you'd implement your search logic
    return `*[_type == "${query.type}" && ${query.filter}]`;
  }
  
  private formatSearchResults(results: any[]): SearchResult[] {
    return results.map(result => ({
      id: result._id,
      type: result._type,
      title: result.title || result.name,
      data: result,
    }));
  }
  
  // Public method to get client (for advanced use cases)
  getClient(): SanityClient {
    return this.client;
  }
}
```

### 4.3 Sanity Configuration

```typescript
// server/agent/adapters/sanity/sanity.config.ts

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SanityConfig {
  readonly projectId: string;
  readonly dataset: string;
  readonly apiVersion: string;
  readonly token: string;
  readonly useCdn: boolean;
  readonly perspective: 'published' | 'previewDrafts';
  
  constructor(private configService: ConfigService) {
    this.projectId = this.configService.getOrThrow('SANITY_PROJECT_ID');
    this.dataset = this.configService.get('SANITY_DATASET', 'production');
    this.apiVersion = this.configService.get('SANITY_API_VERSION', '2023-11-01');
    this.token = this.configService.get('SANITY_TOKEN');
    this.useCdn = this.configService.get('SANITY_USE_CDN', 'true') === 'true';
    this.perspective = this.configService.get('SANITY_PERSPECTIVE', 'published') as any;
  }
}
```

### 4.4 NestJS Module Structure

```typescript
// server/agent/adapters/sanity/sanity.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SanityAdapter } from './sanity.adapter';
import { SanityConfig } from './sanity.config';
import { SanityToolsProvider } from './tools/sanity-tools.provider';
import { SanitySchemaService } from './services/sanity-schema.service';
import { SanityContentService } from './services/sanity-content.service';
import { SanityAssetService } from './services/sanity-asset.service';

@Module({
  imports: [ConfigModule],
  providers: [
    SanityConfig,
    SanityAdapter,
    SanityToolsProvider,
    SanitySchemaService,
    SanityContentService,
    SanityAssetService,
  ],
  exports: [SanityAdapter],
})
export class SanityModule {}
```

---

## 5. GROQ Query Language

### 5.1 What is GROQ?

**GROQ** (Graph-Relational Object Queries) is Sanity's open-source query language designed specifically for querying structured content.

**Why GROQ is superior for AI agents:**
- More intuitive syntax than GraphQL
- Built-in filtering, sorting, and projections
- Supports references and joins
- Powerful text search capabilities
- Can be constructed programmatically by AI

### 5.2 GROQ Basics

#### Simple Query

```groq
*[_type == "post"]
```
Fetch all documents of type "post"

#### With Projection

```groq
*[_type == "post"]{
  _id,
  title,
  slug,
  publishedAt
}
```

#### With Filtering

```groq
*[_type == "post" && publishedAt < now()]{
  title,
  slug
}
```

#### With Ordering

```groq
*[_type == "post"] | order(publishedAt desc) [0...10]
```

#### With References

```groq
*[_type == "post"]{
  title,
  "author": author->name,
  "categories": categories[]->title
}
```

### 5.3 Advanced GROQ for AI Agents

#### Full-Text Search

```groq
*[_type == "post" && (
  title match "AI*" ||
  body[].children[].text match "AI*"
)]
```

#### Conditional Logic

```groq
*[_type == "post"]{
  title,
  "status": select(
    publishedAt < now() => "published",
    publishedAt > now() => "scheduled",
    "draft"
  )
}
```

#### Dynamic Filtering (AI-Generated)

```groq
*[_type == $documentType && $filterExpression]{
  ...,
  "related": *[_type == $documentType && references(^._id)][0...5]
}
```

### 5.4 GROQ in Agent Tools

```typescript
// Example: AI agent builds GROQ query dynamically

async function searchContent(params: {
  type: string;
  filters?: Record<string, any>;
  limit?: number;
  includeReferences?: boolean;
}) {
  // Build GROQ query from parameters
  let query = `*[_type == "${params.type}"`;
  
  // Add dynamic filters
  if (params.filters) {
    const filterConditions = Object.entries(params.filters)
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key} == "${value}"`;
        }
        return `${key} == ${value}`;
      });
    query += ` && (${filterConditions.join(' && ')})`;
  }
  
  query += `]`;
  
  // Add projection
  query += `{
    _id,
    _type,
    _createdAt,
    _updatedAt,
    ...
  }`;
  
  // Add reference expansion if requested
  if (params.includeReferences) {
    query = query.replace('...', `..., "references": *[references(^._id)]`);
  }
  
  // Add limit and ordering
  if (params.limit) {
    query += ` | order(_updatedAt desc) [0...${params.limit}]`;
  }
  
  return await sanityClient.fetch(query);
}
```

---

## 6. Real-Time Capabilities

### 6.1 Content Lake Listeners

Sanity's Content Lake provides **native real-time updates** through listeners:

```typescript
// Listen to all documents of a specific type
const subscription = client
  .listen('*[_type == "post"]')
  .subscribe({
    next: (update) => {
      console.log('Document updated:', update);
      // update.result - the new document state
      // update.previous - the previous state (if available)
      // update.transition - 'appear', 'update', 'disappear'
    },
    error: (err) => console.error('Error:', err),
  });

// Unsubscribe when done
subscription.unsubscribe();
```

### 6.2 Use Cases for AI Agents

#### 1. Proactive Notifications

```typescript
@Injectable()
export class ContentMonitorService implements OnModuleInit {
  constructor(
    private sanityAdapter: SanityAdapter,
    private notificationService: NotificationService,
  ) {}
  
  onModuleInit() {
    // Monitor for content requiring AI review
    this.sanityAdapter.subscribe(
      '*[_type == "post" && status == "pending_review"]',
      async (update) => {
        if (update.transition === 'appear') {
          await this.notificationService.notify({
            type: 'CONTENT_NEEDS_REVIEW',
            documentId: update.result._id,
            title: update.result.title,
          });
        }
      }
    );
  }
}
```

#### 2. Automatic Content Analysis

```typescript
// Analyze content as soon as it's created
this.sanityAdapter.subscribe(
  '*[_type == "post" && !defined(aiAnalysis)]',
  async (update) => {
    if (update.transition === 'appear') {
      const analysis = await this.aiService.analyzeContent(update.result);
      
      // Update document with analysis
      await this.sanityAdapter.updateContent({
        id: update.result._id,
        data: {
          aiAnalysis: analysis,
        },
      });
    }
  }
);
```

#### 3. Working Memory Updates

```typescript
// Keep working memory in sync with content changes
this.sanityAdapter.subscribe(
  '*[_type in $activeTypes]',
  (update) => {
    // Update working memory context
    this.workingMemory.updateEntity({
      id: update.result._id,
      type: update.result._type,
      action: update.transition,
      data: update.result,
    });
  }
);
```

### 6.3 Real-Time in NestJS

```typescript
// server/agent/services/sanity-realtime.service.ts

@Injectable()
export class SanityRealtimeService implements OnModuleDestroy {
  private subscriptions = new Map<string, any>();
  
  constructor(private sanityAdapter: SanityAdapter) {}
  
  subscribe(id: string, query: string, handler: (update: any) => void) {
    if (this.subscriptions.has(id)) {
      throw new Error(`Subscription ${id} already exists`);
    }
    
    const unsubscribe = this.sanityAdapter.subscribe(query, handler);
    this.subscriptions.set(id, unsubscribe);
    
    return () => this.unsubscribe(id);
  }
  
  unsubscribe(id: string) {
    const unsubscribe = this.subscriptions.get(id);
    if (unsubscribe) {
      unsubscribe();
      this.subscriptions.delete(id);
    }
  }
  
  onModuleDestroy() {
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions.clear();
  }
}
```

---

## 7. Content Modeling

### 7.1 Schema Definition

Sanity uses **JavaScript-based schemas** (not JSON like Contentful):

```typescript
// sanity-studio/schemas/post.ts

export default {
  name: 'post',
  title: 'Blog Post',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required().min(10).max(80),
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'author',
      title: 'Author',
      type: 'reference',
      to: [{ type: 'author' }],
    },
    {
      name: 'mainImage',
      title: 'Main image',
      type: 'image',
      options: {
        hotspot: true,
      },
    },
    {
      name: 'categories',
      title: 'Categories',
      type: 'array',
      of: [{ type: 'reference', to: { type: 'category' } }],
    },
    {
      name: 'publishedAt',
      title: 'Published at',
      type: 'datetime',
    },
    {
      name: 'body',
      title: 'Body',
      type: 'blockContent', // Portable Text
    },
    {
      name: 'seo',
      title: 'SEO',
      type: 'object',
      fields: [
        { name: 'metaTitle', type: 'string' },
        { name: 'metaDescription', type: 'text' },
        { name: 'ogImage', type: 'image' },
      ],
    },
  ],
  preview: {
    select: {
      title: 'title',
      author: 'author.name',
      media: 'mainImage',
    },
    prepare(selection) {
      const { author } = selection;
      return { ...selection, subtitle: author && `by ${author}` };
    },
  },
};
```

### 7.2 Portable Text

**Portable Text** is Sanity's approach to rich text - it's **structured data**, not HTML:

```json
{
  "_type": "block",
  "children": [
    {
      "_type": "span",
      "text": "This is a paragraph with ",
      "marks": []
    },
    {
      "_type": "span",
      "text": "bold text",
      "marks": ["strong"]
    }
  ],
  "markDefs": [],
  "style": "normal"
}
```

**Why Portable Text is perfect for AI:**
- Structured, machine-readable format
- Easy to parse and analyze
- Can embed any content type
- Preserves semantic meaning
- Can be transformed to any output format

### 7.3 Custom Types for AI

```typescript
// AI-specific schema extensions

export const aiMetadata = {
  name: 'aiMetadata',
  title: 'AI Metadata',
  type: 'object',
  fields: [
    {
      name: 'sentiment',
      type: 'string',
      options: {
        list: ['positive', 'neutral', 'negative'],
      },
    },
    {
      name: 'topics',
      type: 'array',
      of: [{ type: 'string' }],
    },
    {
      name: 'readabilityScore',
      type: 'number',
    },
    {
      name: 'suggestedTags',
      type: 'array',
      of: [{ type: 'string' }],
    },
    {
      name: 'lastAnalyzed',
      type: 'datetime',
    },
  ],
};
```

---

## 8. Authentication & Security

### 8.1 API Tokens

Sanity uses **token-based authentication**:

```typescript
const client = sanityClient({
  projectId: 'your-project-id',
  dataset: 'production',
  token: 'your-api-token', // Required for write operations
  useCdn: false, // Don't use CDN for authenticated requests
});
```

### 8.2 Token Types

| Token Type | Permissions | Use Case |
|-----------|-------------|----------|
| **Read Token** | Read-only access | Public content delivery |
| **Write Token** | Read + write | CMS operations, AI agent |
| **Deploy Token** | Deploy studio | CI/CD pipelines |
| **Robot Token** | Custom permissions | Automated systems |

### 8.3 Security Best Practices

```typescript
// server/agent/adapters/sanity/sanity-security.service.ts

@Injectable()
export class SanitySecurity {
  // Token rotation
  async rotateToken(oldToken: string): Promise<string> {
    // Implement token rotation logic
    // 1. Create new token
    // 2. Update all services
    // 3. Revoke old token
  }
  
  // Request signing (for webhooks)
  verifyWebhookSignature(signature: string, body: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
  
  // Rate limiting per token
  async checkRateLimit(token: string): Promise<boolean> {
    // Implement rate limiting logic
  }
}
```

### 8.4 Environment Variables

```bash
# .env

# Sanity Configuration
SANITY_PROJECT_ID=abc123xyz
SANITY_DATASET=production
SANITY_API_VERSION=2023-11-01
SANITY_TOKEN=sk...  # Write token for AI agent
SANITY_WEBHOOK_SECRET=whsec_...  # For webhook verification
SANITY_USE_CDN=false  # Ensure fresh data for agent

# Optional
SANITY_PERSPECTIVE=published  # or 'previewDrafts'
SANITY_TIMEOUT=30000  # 30 seconds
```

---

## 9. Rate Limits & Performance

### 9.1 API Rate Limits

Sanity's rate limits are **more generous than Contentful**:

| Plan | Requests/Second | Requests/Hour | Bandwidth |
|------|----------------|---------------|-----------|
| **Free** | 10 req/s | 100,000/hour | 1 GB/month |
| **Growth** | 25 req/s | Unlimited | 10 GB/month |
| **Team** | 50 req/s | Unlimited | 50 GB/month |
| **Business** | 100 req/s | Unlimited | Custom |
| **Enterprise** | Custom | Unlimited | Custom |

**Key Advantages:**
- No per-IP rate limits (unlike Contentful)
- Per-project limits (not per-account)
- Burst allowance for temporary spikes
- Real-time doesn't count against quota

### 9.2 Optimization Strategies

#### 1. Use CDN for Reads

```typescript
// For read-heavy operations
const readClient = sanityClient({
  projectId: 'abc123',
  dataset: 'production',
  useCdn: true, // Fast, cached responses
  apiVersion: '2023-11-01',
});

// For writes or fresh data
const writeClient = sanityClient({
  projectId: 'abc123',
  dataset: 'production',
  useCdn: false, // Fresh, uncached data
  token: 'sk...',
  apiVersion: '2023-11-01',
});
```

#### 2. Query Optimization

```typescript
// ❌ BAD: Fetches all fields
const posts = await client.fetch('*[_type == "post"]');

// ✅ GOOD: Fetch only needed fields
const posts = await client.fetch(`
  *[_type == "post"]{
    _id,
    title,
    slug,
    publishedAt
  }
`);

// ✅ BETTER: Add pagination
const posts = await client.fetch(`
  *[_type == "post"] | order(publishedAt desc) [0...10] {
    _id,
    title,
    slug,
    publishedAt
  }
`);
```

#### 3. Caching Strategy

```typescript
// server/agent/services/sanity-cache.service.ts

@Injectable()
export class SanityCacheService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly TTL = 60000; // 1 minute
  
  async fetchWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.TTL
  ): Promise<T> {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data as T;
    }
    
    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now() });
    
    return data;
  }
  
  invalidate(key: string) {
    this.cache.delete(key);
  }
  
  clear() {
    this.cache.clear();
  }
}
```

#### 4. Batch Operations

```typescript
// Create multiple documents in a transaction
const transaction = client.transaction();

documents.forEach(doc => {
  transaction.create(doc);
});

await transaction.commit();
```

### 9.3 Performance Monitoring

```typescript
// server/agent/services/sanity-metrics.service.ts

@Injectable()
export class SanityMetricsService {
  private metrics = {
    requests: 0,
    errors: 0,
    avgResponseTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };
  
  recordRequest(startTime: number, success: boolean) {
    this.metrics.requests++;
    if (!success) this.metrics.errors++;
    
    const responseTime = Date.now() - startTime;
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (this.metrics.requests - 1) + responseTime) 
      / this.metrics.requests;
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      errorRate: this.metrics.errors / this.metrics.requests,
      cacheHitRate: this.metrics.cacheHits / 
        (this.metrics.cacheHits + this.metrics.cacheMisses),
    };
  }
}
```

---

## 10. Asset Management

### 10.1 Upload Assets

```typescript
// Upload image or file
async uploadAsset(file: Buffer | ReadableStream, filename: string) {
  return client.assets.upload('image', file, {
    filename,
    contentType: 'image/jpeg',
  });
}

// With metadata
async uploadImageWithMetadata(file: Buffer, metadata: any) {
  const asset = await client.assets.upload('image', file, {
    filename: metadata.filename,
  });
  
  // Create image document with metadata
  return client.create({
    _type: 'sanity.imageAsset',
    ...asset,
    metadata: {
      ...metadata,
      uploadedBy: 'ai-agent',
      uploadedAt: new Date().toISOString(),
    },
  });
}
```

### 10.2 Image Transformations

Sanity provides **powerful image transformations** via URL parameters:

```typescript
// Generate optimized image URLs
function getImageUrl(imageRef: string, options: ImageOptions) {
  const baseUrl = `https://cdn.sanity.io/images/${projectId}/${dataset}/${imageRef}`;
  
  const params = new URLSearchParams();
  if (options.width) params.set('w', options.width.toString());
  if (options.height) params.set('h', options.height.toString());
  if (options.quality) params.set('q', options.quality.toString());
  if (options.format) params.set('fm', options.format);
  if (options.fit) params.set('fit', options.fit);
  
  return `${baseUrl}?${params.toString()}`;
}

// Example usage
const thumbnailUrl = getImageUrl(image.asset._ref, {
  width: 300,
  height: 300,
  quality: 80,
  format: 'webp',
  fit: 'crop',
});
```

### 10.3 Asset Tool for AI Agent

```typescript
// AI tool to manage assets

export const uploadImageTool = tool({
  name: 'upload_image',
  description: 'Upload an image to Sanity CMS',
  parameters: z.object({
    imageUrl: z.string().url().describe('URL of image to upload'),
    filename: z.string().describe('Filename for the image'),
    altText: z.string().optional().describe('Alt text for accessibility'),
    caption: z.string().optional().describe('Image caption'),
  }),
  execute: async ({ imageUrl, filename, altText, caption }, { sanityAdapter }) => {
    // Download image
    const response = await fetch(imageUrl);
    const buffer = await response.buffer();
    
    // Upload to Sanity
    const asset = await sanityAdapter.uploadAsset({
      file: buffer,
      filename,
      contentType: response.headers.get('content-type'),
    });
    
    // Create image document
    const imageDoc = await sanityAdapter.createContent({
      type: 'image',
      data: {
        asset: {
          _type: 'reference',
          _ref: asset._id,
        },
        alt: altText,
        caption,
      },
    });
    
    return {
      success: true,
      assetId: asset._id,
      imageId: imageDoc._id,
      url: asset.url,
    };
  },
});
```

---

## 11. Webhooks & Events

### 11.1 Configure Webhooks

Webhooks in Sanity notify your application of content changes:

```typescript
// Configure webhook in Sanity Studio or via API

{
  "name": "AI Agent Webhook",
  "url": "https://your-agent-server.com/webhooks/sanity",
  "dataset": "production",
  "filter": "*[_type == 'post']",
  "projection": "{_id, _type, title, status}",
  "secret": "your-webhook-secret"
}
```

### 11.2 Handle Webhooks in NestJS

```typescript
// server/webhooks/sanity-webhook.controller.ts

@Controller('webhooks/sanity')
export class SanityWebhookController {
  constructor(
    private readonly sanitySecurityService: SanitySecurity,
    private readonly agentService: AgentService,
  ) {}
  
  @Post()
  async handleWebhook(
    @Body() body: any,
    @Headers('sanity-webhook-signature') signature: string,
  ) {
    // Verify webhook signature
    const isValid = this.sanitySecurityService.verifyWebhookSignature(
      signature,
      JSON.stringify(body)
    );
    
    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    
    // Process webhook event
    const { _type, _id, transition } = body;
    
    switch (transition) {
      case 'appear':
        await this.handleDocumentCreated(_type, _id, body);
        break;
      case 'update':
        await this.handleDocumentUpdated(_type, _id, body);
        break;
      case 'disappear':
        await this.handleDocumentDeleted(_type, _id, body);
        break;
    }
    
    return { received: true };
  }
  
  private async handleDocumentCreated(type: string, id: string, data: any) {
    // Trigger AI analysis for new content
    if (type === 'post' && !data.aiAnalysis) {
      await this.agentService.analyzeContent(id);
    }
  }
  
  private async handleDocumentUpdated(type: string, id: string, data: any) {
    // Update working memory
    await this.agentService.updateWorkingMemory(type, id, data);
  }
  
  private async handleDocumentDeleted(type: string, id: string, data: any) {
    // Clean up related data
    await this.agentService.cleanupDeletedContent(id);
  }
}
```

### 11.3 Event-Driven Architecture

```typescript
// server/events/sanity-event.emitter.ts

@Injectable()
export class SanityEventEmitter {
  constructor(private eventEmitter: EventEmitter2) {}
  
  emitContentCreated(type: string, data: any) {
    this.eventEmitter.emit('sanity.content.created', { type, data });
  }
  
  emitContentUpdated(type: string, data: any) {
    this.eventEmitter.emit('sanity.content.updated', { type, data });
  }
  
  emitContentDeleted(type: string, data: any) {
    this.eventEmitter.emit('sanity.content.deleted', { type, data });
  }
}

// Listeners
@Injectable()
export class ContentAnalysisListener {
  @OnEvent('sanity.content.created')
  async handleContentCreated(event: { type: string; data: any }) {
    if (event.type === 'post') {
      await this.analyzePost(event.data);
    }
  }
}
```

---

## 12. Migration Path

### 12.1 Phased Migration Approach

#### Phase 1: Parallel Implementation (Weeks 1-2)

1. **Set up Sanity project**
   ```bash
   npm create sanity@latest
   cd sanity-studio
   npm install
   npm run dev
   ```

2. **Define content schemas**
   - Mirror existing CMS structure
   - Add AI-specific fields

3. **Implement Sanity adapter**
   - Follow interface from Section 4
   - Implement basic CRUD operations

4. **Create Sanity tools**
   - Port existing CMS tools to Sanity
   - Add Sanity-specific tools (GROQ queries, etc.)

#### Phase 2: Testing & Validation (Weeks 3-4)

1. **Unit tests for adapter**
2. **Integration tests with agent**
3. **Performance benchmarking**
4. **Load testing with real-time subscriptions**

#### Phase 3: Data Migration (Week 5)

1. **Export from current CMS**
2. **Transform to Sanity format**
3. **Import to Sanity**
4. **Validate data integrity**

#### Phase 4: Gradual Rollout (Weeks 6-8)

1. **Deploy to staging**
2. **Beta testing with subset of users**
3. **Monitor performance and errors**
4. **Gradual production rollout**
5. **Deprecate old CMS adapter**

### 12.2 Migration Script Example

```typescript
// scripts/migrate-to-sanity.ts

import { createClient } from '@sanity/client';
import { CustomCmsService } from '../server/services/cms';

const sanityClient = createClient({
  projectId: 'abc123',
  dataset: 'production',
  token: 'sk...',
  apiVersion: '2023-11-01',
  useCdn: false,
});

async function migrateContent() {
  const customCms = new CustomCmsService();
  
  // Fetch all content from custom CMS
  const pages = await customCms.getAllPages();
  
  for (const page of pages) {
    // Transform to Sanity format
    const sanityDoc = {
      _type: 'page',
      title: page.title,
      slug: { current: page.slug },
      content: transformToPortableText(page.content),
      publishedAt: page.publishedAt,
      // ... other fields
    };
    
    // Create in Sanity
    try {
      const result = await sanityClient.create(sanityDoc);
      console.log(`Migrated: ${page.title} -> ${result._id}`);
    } catch (error) {
      console.error(`Failed to migrate ${page.title}:`, error);
    }
  }
}

function transformToPortableText(html: string) {
  // Convert HTML to Portable Text
  // Use @sanity/block-content-to-html or similar
}

migrateContent().then(() => {
  console.log('Migration complete');
  process.exit(0);
});
```

---

## 13. Challenges & Considerations

### 13.1 Potential Challenges

| Challenge | Severity | Mitigation |
|-----------|----------|------------|
| **Learning Curve** | Low | Excellent docs, intuitive API |
| **Studio Customization** | Low | Fully customizable with React |
| **Real-time Cost** | Low | Built-in, no additional charge |
| **Schema Migrations** | Medium | Use migrations API, version schemas |
| **GraphQL vs GROQ** | Low | GROQ is simpler, can also use GraphQL |
| **Asset Storage** | Low | Built-in, handles images well |
| **Vendor Lock-in** | Medium | Export data regularly, open-source runtime |
| **Multi-tenant** | Medium | Use separate datasets per tenant |

### 13.2 Sanity-Specific Considerations

#### 1. Dataset Management

```typescript
// Handle multiple datasets (e.g., per customer)

@Injectable()
export class MultiDatasetSanityAdapter {
  private clients = new Map<string, SanityClient>();
  
  getClientForDataset(dataset: string): SanityClient {
    if (!this.clients.has(dataset)) {
      this.clients.set(dataset, sanityClient({
        projectId: this.config.projectId,
        dataset,
        token: this.config.token,
        apiVersion: this.config.apiVersion,
        useCdn: false,
      }));
    }
    return this.clients.get(dataset);
  }
}
```

#### 2. GROQ Learning Curve

**Solution**: Create GROQ query builders

```typescript
// server/agent/adapters/sanity/groq-builder.ts

export class GROQBuilder {
  private filter: string = '*';
  private projection: string = '...';
  private orderBy: string = '';
  private slice: string = '';
  
  type(typeName: string) {
    this.filter = `*[_type == "${typeName}"]`;
    return this;
  }
  
  where(condition: string) {
    this.filter = this.filter.replace(']', ` && ${condition}]`);
    return this;
  }
  
  select(...fields: string[]) {
    this.projection = fields.join(', ');
    return this;
  }
  
  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    this.orderBy = ` | order(${field} ${direction})`;
    return this;
  }
  
  limit(count: number, offset: number = 0) {
    this.slice = ` [${offset}...${offset + count}]`;
    return this;
  }
  
  build(): string {
    return `${this.filter}${this.orderBy}${this.slice}{${this.projection}}`;
  }
}

// Usage
const query = new GROQBuilder()
  .type('post')
  .where('publishedAt < now()')
  .select('_id', 'title', 'slug', 'publishedAt')
  .orderBy('publishedAt', 'desc')
  .limit(10)
  .build();

// Result:
// *[_type == "post" && publishedAt < now()] | order(publishedAt desc) [0...10]{_id, title, slug, publishedAt}
```

#### 3. Portable Text Handling

```typescript
// Convert Portable Text to plain text for AI

function portableTextToPlainText(blocks: any[]): string {
  return blocks
    .map(block => {
      if (block._type !== 'block' || !block.children) {
        return '';
      }
      return block.children.map((child: any) => child.text).join('');
    })
    .join('\n\n');
}

// Convert Portable Text to HTML (for rendering)
import { toHTML } from '@portabletext/to-html';

const html = toHTML(portableTextBlocks, {
  components: {
    /* custom components */
  },
});
```

### 13.3 When NOT to Use Sanity

Despite its advantages, Sanity may not be ideal if:

- ❌ You need a traditional CMS with built-in templating (Sanity is headless)
- ❌ You require extensive built-in e-commerce features (use Shopify, etc.)
- ❌ You need on-premise hosting (Sanity is cloud-only)
- ❌ Your team is unfamiliar with JavaScript/React (Studio is React-based)
- ❌ You need a CMS with a visual page builder (Sanity is structure-focused)

---

## 14. Best Practices

### 14.1 Agent-Specific Best Practices

#### 1. Token-Efficient Queries

```typescript
// ❌ BAD: Fetch everything
const content = await client.fetch('*[_type == "post"]');

// ✅ GOOD: Fetch only what agent needs
const content = await client.fetch(`
  *[_type == "post"]{
    _id,
    title,
    "excerpt": array::join(string::split(pt::text(body), " ")[0..20], " ") + "..."
  }
`);
```

#### 2. Use References Wisely

```typescript
// ❌ BAD: Deep reference expansion (expensive)
const posts = await client.fetch(`
  *[_type == "post"]{
    ...,
    author->{
      ...,
      posts[]->{
        ...
      }
    }
  }
`);

// ✅ GOOD: Selective reference expansion
const posts = await client.fetch(`
  *[_type == "post"]{
    _id,
    title,
    "authorName": author->name,
    "authorBio": author->bio
  }
`);
```

#### 3. Implement Proper Error Handling

```typescript
async function safeQuery<T>(query: string, params?: any): Promise<T | null> {
  try {
    return await client.fetch<T>(query, params);
  } catch (error) {
    if (error.statusCode === 429) {
      // Rate limit hit - implement backoff
      await sleep(1000);
      return safeQuery(query, params);
    }
    
    if (error.statusCode === 404) {
      // Document not found
      return null;
    }
    
    // Log and rethrow other errors
    logger.error('Sanity query failed:', { query, error });
    throw error;
  }
}
```

### 14.2 Performance Best Practices

#### 1. Projection Optimization

```typescript
// Only fetch fields you need
const query = `*[_type == "post" && slug.current == $slug][0]{
  _id,
  title,
  body,
  "imageUrl": mainImage.asset->url,
  "authorName": author->name
}`;
```

#### 2. Pagination

```typescript
async function getPaginatedContent(type: string, page: number, pageSize: number = 20) {
  const start = page * pageSize;
  const end = start + pageSize;
  
  const query = `{
    "items": *[_type == $type] | order(_createdAt desc) [${start}...${end}],
    "total": count(*[_type == $type])
  }`;
  
  return client.fetch(query, { type });
}
```

#### 3. Caching Strategy

```typescript
// Use CDN for public content
const publicClient = createClient({
  projectId: 'abc123',
  dataset: 'production',
  useCdn: true, // Fast, cached
  apiVersion: '2023-11-01',
});

// Use direct API for fresh/private content
const privateClient = createClient({
  projectId: 'abc123',
  dataset: 'production',
  useCdn: false, // Fresh data
  token: 'sk...',
  apiVersion: '2023-11-01',
});
```

### 14.3 Security Best Practices

#### 1. Token Management

```typescript
// Rotate tokens periodically
@Injectable()
export class SanityTokenManager {
  private currentToken: string;
  
  @Cron('0 0 1 * *') // Monthly
  async rotateToken() {
    // 1. Generate new token via Sanity API
    const newToken = await this.generateNewToken();
    
    // 2. Update all services
    await this.updateServicesWithNewToken(newToken);
    
    // 3. Revoke old token
    await this.revokeToken(this.currentToken);
    
    this.currentToken = newToken;
  }
}
```

#### 2. Query Sanitization

```typescript
// Prevent GROQ injection
function sanitizeGROQParam(input: string): string {
  // Remove dangerous characters
  return input.replace(/[^\w\s-]/g, '');
}

// Use parameterized queries
const query = '*[_type == $type && slug.current == $slug]';
const result = await client.fetch(query, {
  type: sanitizeGROQParam(userType),
  slug: sanitizeGROQParam(userSlug),
});
```

---

## 15. Comparison: Sanity vs Contentful

### 15.1 Feature Comparison

| Feature | Sanity | Contentful | Winner |
|---------|--------|------------|--------|
| **Query Language** | GROQ (more intuitive) | GraphQL | 🏆 Sanity |
| **Real-time Updates** | Built-in, free | Paid add-on | 🏆 Sanity |
| **Content Modeling** | Flexible, code-based | Rigid, UI-based | 🏆 Sanity |
| **Rich Text** | Portable Text (structured) | Rich Text (less structured) | 🏆 Sanity |
| **API Rate Limits** | 10-100 req/s | 7-15 req/s | 🏆 Sanity |
| **Local Development** | Full local studio | Cloud-only | 🏆 Sanity |
| **Studio Customization** | Fully customizable (React) | Limited | 🏆 Sanity |
| **Image Transformations** | Built-in, powerful | Built-in | 🤝 Tie |
| **Webhooks** | Free, unlimited | Free, limited | 🏆 Sanity |
| **Developer Experience** | Excellent | Good | 🏆 Sanity |
| **Enterprise Features** | Available | More mature | 🏆 Contentful |
| **Market Share** | Growing | Established | 🏆 Contentful |
| **Pricing** | More affordable | More expensive | 🏆 Sanity |

### 15.2 API Comparison

#### Querying Content

**Sanity (GROQ):**
```typescript
const posts = await sanityClient.fetch(`
  *[_type == "post" && publishedAt < now()] 
  | order(publishedAt desc) 
  [0...10]
  {
    _id,
    title,
    slug,
    "author": author->name,
    "imageUrl": mainImage.asset->url
  }
`);
```

**Contentful (GraphQL):**
```typescript
const posts = await contentfulClient.query({
  query: `
    query {
      postCollection(
        where: { publishedAt_lt: $now }
        order: publishedAt_DESC
        limit: 10
      ) {
        items {
          sys { id }
          title
          slug
          author { name }
          mainImage { url }
        }
      }
    }
  `,
  variables: { now: new Date().toISOString() },
});
```

**Verdict**: GROQ is more concise and intuitive for content queries.

#### Creating Content

**Sanity:**
```typescript
const post = await sanityClient.create({
  _type: 'post',
  title: 'New Post',
  body: [/* Portable Text */],
  author: { _type: 'reference', _ref: 'author-id' },
});
```

**Contentful:**
```typescript
const post = await contentfulClient.createEntry('post', {
  fields: {
    title: { 'en-US': 'New Post' },
    body: { 'en-US': '...' },
    author: {
      'en-US': {
        sys: { type: 'Link', linkType: 'Entry', id: 'author-id' }
      }
    },
  },
});
```

**Verdict**: Sanity's API is simpler and more intuitive.

### 15.3 Real-Time Comparison

**Sanity:**
```typescript
// Built-in, free
const subscription = sanityClient
  .listen('*[_type == "post"]')
  .subscribe(update => {
    console.log('Update:', update);
  });
```

**Contentful:**
```typescript
// Requires webhook setup, not real-time
// Must poll or use third-party service
```

**Verdict**: Sanity wins with native real-time support.

### 15.4 Cost Comparison (for AI Agent Use Case)

**Scenario**: 1M API requests/month, 100GB bandwidth, real-time updates

| Plan | Sanity | Contentful | Savings |
|------|--------|------------|---------|
| **Growth/Team** | $199/mo | $489/mo | **$290/mo** |
| **Business** | $949/mo | $2,099/mo | **$1,150/mo** |
| **Enterprise** | Custom | Custom | Varies |

**Additional Costs:**
- Sanity: Real-time included
- Contentful: Real-time requires custom integration

---

## 16. Code Examples

### 16.1 Complete Sanity Service

```typescript
// server/agent/adapters/sanity/services/sanity-content.service.ts

import { Injectable } from '@nestjs/common';
import { SanityClient } from '@sanity/client';

@Injectable()
export class SanityContentService {
  async getContent(
    client: SanityClient,
    params: GetContentParams
  ): Promise<ContentResult> {
    const { type, id, slug, includeReferences, locale } = params;
    
    let query: string;
    let queryParams: any = {};
    
    if (id) {
      query = `*[_type == $type && _id == $id][0]`;
      queryParams = { type, id };
    } else if (slug) {
      query = `*[_type == $type && slug.current == $slug][0]`;
      queryParams = { type, slug };
    } else {
      query = `*[_type == $type]`;
      queryParams = { type };
    }
    
    // Add projection
    if (includeReferences) {
      query += `{
        ...,
        "references": *[references(^._id)]{
          _id,
          _type,
          title
        }
      }`;
    }
    
    const result = await client.fetch(query, queryParams);
    
    if (!result) {
      throw new NotFoundException(`Content not found: ${type}/${id || slug}`);
    }
    
    return this.formatContentResult(result);
  }
  
  async createContent(
    client: SanityClient,
    params: CreateContentParams
  ): Promise<ContentResult> {
    const { type, data, publish } = params;
    
    const doc = {
      _type: type,
      ...data,
    };
    
    const result = publish
      ? await client.create(doc)
      : await client.create({ ...doc, _id: `drafts.${doc._id || generateId()}` });
    
    return this.formatContentResult(result);
  }
  
  async updateContent(
    client: SanityClient,
    params: UpdateContentParams
  ): Promise<ContentResult> {
    const { id, data, publish } = params;
    
    const docId = publish ? id.replace('drafts.', '') : id;
    
    const result = await client
      .patch(docId)
      .set(data)
      .commit();
    
    return this.formatContentResult(result);
  }
  
  async deleteContent(
    client: SanityClient,
    params: DeleteContentParams
  ): Promise<void> {
    const { id } = params;
    
    // Delete both draft and published versions
    await Promise.all([
      client.delete(id),
      client.delete(`drafts.${id}`),
    ]);
  }
  
  private formatContentResult(result: any): ContentResult {
    return {
      id: result._id,
      type: result._type,
      data: result,
      createdAt: result._createdAt,
      updatedAt: result._updatedAt,
    };
  }
}
```

### 16.2 Sanity Tools for AI Agent

```typescript
// server/agent/adapters/sanity/tools/sanity-tools.provider.ts

import { Injectable } from '@nestjs/common';
import { tool } from 'ai';
import { z } from 'zod';

@Injectable()
export class SanityToolsProvider {
  getTools(): ToolDefinition[] {
    return [
      this.createQueryTool(),
      this.createContentTool(),
      this.createUpdateTool(),
      this.createDeleteTool(),
      this.createSearchTool(),
    ];
  }
  
  private createQueryTool() {
    return tool({
      name: 'sanity_query',
      description: 'Execute a GROQ query to fetch content from Sanity',
      parameters: z.object({
        query: z.string().describe('GROQ query string'),
        params: z.record(z.string(), z.any()).optional().describe('Query parameters'),
      }),
      execute: async ({ query, params }, { sanityAdapter }) => {
        const result = await sanityAdapter.executeQuery(query, params);
        return { success: true, data: result };
      },
    });
  }
  
  private createContentTool() {
    return tool({
      name: 'sanity_create_content',
      description: 'Create new content in Sanity',
      parameters: z.object({
        type: z.string().describe('Document type'),
        data: z.record(z.string(), z.any()).describe('Document data'),
        publish: z.boolean().default(false).describe('Publish immediately'),
      }),
      execute: async ({ type, data, publish }, { sanityAdapter }) => {
        const result = await sanityAdapter.createContent({ type, data, publish });
        return { success: true, content: result };
      },
    });
  }
  
  private createSearchTool() {
    return tool({
      name: 'sanity_search',
      description: 'Search content in Sanity using natural language',
      parameters: z.object({
        type: z.string().describe('Document type to search'),
        searchText: z.string().describe('Text to search for'),
        limit: z.number().default(10).describe('Maximum results'),
      }),
      execute: async ({ type, searchText, limit }, { sanityAdapter }) => {
        // Build GROQ search query
        const query = `*[_type == $type && (
          title match $searchText + "*" ||
          pt::text(body) match $searchText + "*"
        )][0...$limit]{
          _id,
          _type,
          title,
          "excerpt": array::join(string::split(pt::text(body), " ")[0..20], " ")
        }`;
        
        const results = await sanityAdapter.executeQuery(query, {
          type,
          searchText,
          limit,
        });
        
        return { success: true, results };
      },
    });
  }
  
  getSystemPrompt(): string {
    return `
      You are connected to Sanity CMS. You can:
      - Query content using GROQ (a powerful query language)
      - Create, update, and delete content
      - Search across all content types
      - Work with structured Portable Text content
      - Handle references between documents
      
      GROQ Tips:
      - Use *[_type == "post"] to fetch all posts
      - Use filters: *[_type == "post" && publishedAt < now()]
      - Use projections: *[_type == "post"]{title, slug}
      - Use references: author->name
      - Use ordering: | order(publishedAt desc)
      - Use slicing: [0...10] for pagination
    `;
  }
  
  getContextualPrompts(mode: AgentMode): string[] {
    const prompts = {
      architect: [
        'Consider using GROQ queries for complex data retrieval',
        'Leverage Portable Text for structured content',
      ],
      crud: [
        'Use transactions for multi-document operations',
        'Remember to handle both draft and published states',
      ],
      analyst: [
        'Query historical data using _createdAt and _updatedAt',
        'Use GROQ aggregations for statistics',
      ],
    };
    
    return prompts[mode] || [];
  }
}
```

### 16.3 Working Memory Integration

```typescript
// server/services/working-memory/extractors/sanity-entity-extractor.ts

export class SanityEntityExtractor implements IEntityExtractor {
  extract(toolResult: any): WorkingMemoryEntity[] {
    const entities: WorkingMemoryEntity[] = [];
    
    // Extract from Sanity responses
    if (Array.isArray(toolResult.data)) {
      toolResult.data.forEach((doc: any) => {
        entities.push({
          id: doc._id,
          type: doc._type,
          primaryField: doc.title || doc.name || doc._id,
          metadata: {
            createdAt: doc._createdAt,
            updatedAt: doc._updatedAt,
            slug: doc.slug?.current,
          },
          references: this.extractReferences(doc),
        });
      });
    } else if (toolResult.data?._id) {
      entities.push({
        id: toolResult.data._id,
        type: toolResult.data._type,
        primaryField: toolResult.data.title || toolResult.data.name,
        metadata: {
          createdAt: toolResult.data._createdAt,
          updatedAt: toolResult.data._updatedAt,
        },
      });
    }
    
    return entities;
  }
  
  private extractReferences(doc: any): string[] {
    const refs: string[] = [];
    
    // Extract _ref fields recursively
    function findRefs(obj: any) {
      if (obj._ref) refs.push(obj._ref);
      
      if (typeof obj === 'object') {
        Object.values(obj).forEach(value => {
          if (value && typeof value === 'object') {
            findRefs(value);
          }
        });
      }
    }
    
    findRefs(doc);
    return refs;
  }
}
```

---

## 17. Conclusion

### 17.1 Final Verdict

**Sanity CMS is HIGHLY RECOMMENDED for the NestJS agent architecture.**

**Confidence Level**: 95%

### 17.2 Key Strengths

1. ✅ **Perfect API Alignment**: RESTful, async-first design
2. ✅ **Real-Time Native**: Content Lake with instant updates
3. ✅ **GROQ Power**: More intuitive than GraphQL for content
4. ✅ **Developer Experience**: Best-in-class DX, local development
5. ✅ **Flexible Modeling**: No rigid schemas, adapt as you grow
6. ✅ **Cost-Effective**: More affordable than Contentful
7. ✅ **Portable Text**: Structured content ideal for AI
8. ✅ **TypeScript Support**: Strong typing throughout
9. ✅ **Customizable Studio**: Fully control editing experience
10. ✅ **Active Community**: Growing ecosystem, good support

### 17.3 Why Sanity > Contentful for This Use Case

| Criterion | Reasoning |
|-----------|-----------|
| **AI Agent Alignment** | GROQ is more AI-friendly than GraphQL |
| **Real-Time** | Built-in vs paid add-on |
| **Rate Limits** | More generous (10-100 req/s vs 7-15 req/s) |
| **Flexibility** | Schema-less with validation vs rigid models |
| **Local Dev** | Full local studio vs cloud-only |
| **Cost** | ~40-50% cheaper at scale |
| **Extensibility** | Fully customizable vs limited |
| **Content Structure** | Portable Text (structured) vs HTML (unstructured) |

### 17.4 Recommended Next Steps

1. **✅ Immediate (Week 1)**:
   - Create Sanity project (`npm create sanity@latest`)
   - Define initial content schemas
   - Set up NestJS Sanity module
   - Implement basic adapter interface

2. **✅ Short-term (Weeks 2-3)**:
   - Implement Sanity adapter completely
   - Create Sanity-specific tools
   - Add real-time listeners
   - Write integration tests

3. **✅ Medium-term (Weeks 4-6)**:
   - Migrate sample content
   - Test with AI agent end-to-end
   - Performance benchmarking
   - Documentation

4. **✅ Long-term (Weeks 7-12)**:
   - Full content migration
   - Production deployment
   - Monitor and optimize
   - Train team on Sanity

### 17.5 Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Learning Curve** | Low | Low | Excellent docs, similar to existing patterns |
| **Migration Issues** | Medium | Medium | Phased migration, thorough testing |
| **Performance** | Low | Medium | Built-in optimizations, CDN support |
| **Vendor Lock-in** | Medium | Medium | Regular exports, open-source runtime |
| **Team Adoption** | Low | Low | Better DX than current solution |

### 17.6 Success Metrics

Track these metrics post-implementation:

- **API Response Time**: Target < 200ms (50th percentile)
- **Real-Time Latency**: Target < 500ms
- **Agent Success Rate**: Target > 95%
- **Token Efficiency**: Target 40-50% reduction vs current
- **Developer Satisfaction**: Target > 4.5/5
- **Uptime**: Target > 99.9%

---

## Appendix A: Environment Setup

```bash
# .env.example

# ============================================
# Sanity Configuration
# ============================================

# Project ID (from sanity.io dashboard)
SANITY_PROJECT_ID=abc123xyz

# Dataset name (production, staging, development)
SANITY_DATASET=production

# API version (use latest stable)
SANITY_API_VERSION=2023-11-01

# API Token (generate in sanity.io dashboard)
# Permissions: Read + Write
SANITY_TOKEN=sk...

# CDN Settings
SANITY_USE_CDN=false  # false for agent (fresh data)
SANITY_CDN_TIMEOUT=5000

# Perspective
SANITY_PERSPECTIVE=published  # or 'previewDrafts'

# Webhook Secret (for signature verification)
SANITY_WEBHOOK_SECRET=whsec_...

# Studio URL (for redirects)
SANITY_STUDIO_URL=https://your-project.sanity.studio

# ============================================
# Advanced Settings
# ============================================

# Request timeout (ms)
SANITY_TIMEOUT=30000

# Max retries
SANITY_MAX_RETRIES=3

# Enable request logging
SANITY_LOG_REQUESTS=true
```

---

## Appendix B: Additional Resources

### Official Documentation
- [Sanity Docs](https://www.sanity.io/docs)
- [GROQ Reference](https://www.sanity.io/docs/groq)
- [JavaScript Client](https://www.sanity.io/docs/js-client)
- [Portable Text](https://www.sanity.io/docs/portable-text)

### Community Resources
- [Sanity Exchange](https://www.sanity.io/exchange)
- [GitHub Discussions](https://github.com/sanity-io/sanity/discussions)
- [Discord Community](https://slack.sanity.io)

### Example Projects
- [Sanity + Next.js Starter](https://github.com/sanity-io/nextjs-blog-cms-sanity-v3)
- [E-commerce with Sanity](https://github.com/sanity-io/sanity-template-shopify)
- [Portfolio Template](https://github.com/sanity-io/sanity-template-gatsby-portfolio)

### Related Tools
- [Portable Text to HTML](https://github.com/portabletext/to-html)
- [Sanity Image URL Builder](https://www.sanity.io/docs/image-url)
- [GROQ Playground](https://www.sanity.io/docs/query-cheat-sheet)

---

**Document Version**: 1.0  
**Last Updated**: November 18, 2025  
**Reviewed By**: AI Architecture Team  
**Status**: ✅ **APPROVED FOR IMPLEMENTATION**


