import { connect, type Table } from "@lancedb/lancedb";

export interface ResourceDocument {
  id: string;
  type: "page" | "section_def" | "collection" | "entry" | "image";
  name: string;
  slug: string;
  searchableText: string;
  metadata: Record<string, any>;
  embedding: number[];
  updatedAt: Date;
}

export interface SearchResult {
  id: string;
  type: string;
  name: string;
  slug: string;
  similarity: number;
}

export interface ImageVectorRecord {
  id: string;
  type: "image";
  filename: string;
  description: string;
  searchableText: string;
  textEmbedding: number[];
  imageEmbedding?: number[];
  metadata: {
    tags: string[];
    categories: string[];
    colors: string[];
    mood: string;
    style: string;
  };
}

export interface ImageSearchResult {
  id: string;
  filename: string;
  description: string;
  score: number;
  metadata: {
    tags: string[];
    categories: string[];
    colors: string[];
    mood: string;
    style: string;
  };
}

export class VectorIndexService {
  private db: any;
  private table: Table | null = null;

  constructor(private dbPath: string) {}

  async initialize() {
    this.db = await connect(this.dbPath);

    try {
      this.table = await this.db.openTable("resource_index");
      console.log("✓ Vector index opened");
    } catch {
      // Table doesn't exist, create it with initial dummy data
      // LanceDB requires at least one record to infer schema
      const dummyRecord = {
        id: "__init__",
        type: "page",
        name: "__init__",
        slug: "__init__",
        searchableText: "__init__",
        metadataJson: "{}",
        embedding: new Array(1536).fill(0),
        updatedAt: Date.now(),
      };

      this.table = await this.db.createTable("resource_index", [dummyRecord], {
        mode: "create",
      });

      // Delete the dummy record
      if (this.table) {
        await this.table.delete("id = '__init__'");
      }

      console.log("✓ Vector index table created");
    }
  }

  async add(doc: Omit<ResourceDocument, "embedding" | "updatedAt">) {
    if (!this.table) await this.initialize();

    // Generate embedding
    const embedding = await this.embed(doc.searchableText);

    const record = {
      id: doc.id,
      type: doc.type,
      name: doc.name,
      slug: doc.slug,
      searchableText: doc.searchableText,
      metadataJson: JSON.stringify(doc.metadata),
      embedding,
      updatedAt: Date.now(),
    };

    await this.table?.add([record]);
  }

  async update(id: string, doc: Partial<Omit<ResourceDocument, "id" | "embedding" | "updatedAt">>) {
    if (!this.table) await this.initialize();

    // Delete old record
    await this.delete(id);

    // Generate new searchable text if fields changed
    let searchableText = doc.searchableText;
    if (!searchableText && (doc.name || doc.slug)) {
      searchableText = `${doc.name || ""} ${doc.slug || ""}`.trim();
    }

    if (!searchableText) {
      console.warn(`No searchable text for update of ${id}`);
      return;
    }

    // Re-add with new embedding
    const embedding = await this.embed(searchableText);

    const record = {
      id,
      type: doc.type!,
      name: doc.name!,
      slug: doc.slug!,
      searchableText: searchableText!,
      metadataJson: JSON.stringify(doc.metadata || {}),
      embedding,
      updatedAt: Date.now(),
    };

    await this.table?.add([record]);
  }

  async search(query: string, type?: string, limit = 3): Promise<SearchResult[]> {
    if (!this.table) await this.initialize();

    // Generate query embedding
    const queryEmbedding = await this.embed(query);

    // Vector similarity search
    let results = await this.table
      ?.vectorSearch(queryEmbedding)
      .limit(limit * 2)
      .toArray();

    if (!results) {
      return [];
    }

    // Filter by type if specified
    if (type) {
      results = results.filter((r: any) => r.type === type);
    }

    // Return top results
    return results.slice(0, limit).map((r: any) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      slug: r.slug,
      similarity: r._distance ? 1 - r._distance : 0, // Convert distance to similarity
    }));
  }

  async exists(id: string): Promise<boolean> {
    if (!this.table) await this.initialize();

    try {
      // Simple filter query to check existence
      const results = await this.table?.query().where(`id = '${id}'`).limit(1).toArray();
      return results ? results.length > 0 : false;
    } catch {
      // If query fails, assume doesn't exist
      return false;
    }
  }

  async delete(id: string) {
    if (!this.table) await this.initialize();

    await this.table?.delete(`id = '${id}'`);
  }

  async close() {
    // LanceDB auto-closes connections
  }

  /**
   * Add image to vector index with text embeddings from metadata
   */
  async addImage(data: ImageVectorRecord): Promise<void> {
    if (!this.table) await this.initialize();

    const record = {
      id: data.id,
      type: "image",
      name: data.filename,
      slug: data.filename,
      searchableText: data.searchableText,
      metadataJson: JSON.stringify({
        ...data.metadata,
        imageEmbedding: data.imageEmbedding ? "present" : "absent",
      }),
      embedding: data.textEmbedding, // Use text embedding for search (512 dims)
      updatedAt: Date.now(),
    };

    await this.table?.add([record]);
  }

  /**
   * Search images by natural language query
   * Generates embeddings via OpenRouter and does similarity search
   */
  async searchImages(
    query: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ results: ImageSearchResult[]; total: number }> {
    if (!this.table) await this.initialize();

    const limit = options.limit || 10;
    const offset = options.offset || 0;

    try {
      // Generate query embedding using OpenRouter (same as document embedding)
      const queryEmbedding = await this.embed(query);

      // Vector similarity search - fetch more results for pagination
      const results = await this.table
        ?.vectorSearch(queryEmbedding)
        .where("type = 'image'")
        .limit(limit + offset + 100) // Fetch extra for accurate pagination
        .toArray();

      if (!results || results.length === 0) {
        return { results: [], total: 0 };
      }

      // Apply pagination
      const paginatedResults = results.slice(offset, offset + limit);

      return {
        results: paginatedResults.map((r: any) => ({
          id: r.id,
          filename: r.name,
          description: r.searchableText.split(" ").slice(0, 20).join(" "),
          score: r._distance ? 1 - r._distance : 0, // Convert distance to similarity
          metadata: r.metadataJson ? JSON.parse(r.metadataJson) : {},
        })),
        total: results.length,
      };
    } catch (error) {
      console.error("Image search error:", error);
      return { results: [], total: 0 };
    }
  }

  /**
   * Find single best matching image by description
   */
  async findImageByDescription(description: string): Promise<ImageSearchResult> {
    const { results } = await this.searchImages(description, { limit: 1 });

    if (results.length === 0) {
      throw new Error(`No images found matching: "${description}"`);
    }

    return results[0];
  }

  /**
   * Delete image from vector index
   */
  async deleteImage(imageId: string): Promise<void> {
    if (!this.table) await this.initialize();
    await this.table?.delete(`id = '${imageId}'`);
  }

  /**
   * Update image metadata in vector index (delete + re-add)
   */
  async updateImageMetadata(
    imageId: string,
    data: Partial<ImageVectorRecord>
  ): Promise<void> {
    // LanceDB doesn't support updates, so delete and re-add
    await this.deleteImage(imageId);
    if (data.id) {
      await this.addImage(data as ImageVectorRecord);
    }
  }

  private async embed(text: string): Promise<number[]> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.EMBEDDING_MODEL || "openai/text-embedding-3-small";

    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.OPENROUTER_HEADERS
            ? JSON.parse(process.env.OPENROUTER_HEADERS)["HTTP-Referer"]
            : "http://localhost:3000",
          "X-Title": process.env.OPENROUTER_HEADERS
            ? JSON.parse(process.env.OPENROUTER_HEADERS)["X-Title"]
            : "ReAct CMS Agent",
        },
        body: JSON.stringify({
          model,
          input: text.slice(0, 8000), // Truncate to 8000 chars for safety
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error: any) {
      console.error("Embedding error:", error.message);
      // Return zero vector as fallback
      return new Array(1536).fill(0);
    }
  }
}

// No default export - use ServiceContainer.get().vectorIndex instead
// This ensures a single instance managed by the service container
