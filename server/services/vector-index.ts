import { connect, type Table } from "@lancedb/lancedb";

export interface ResourceDocument {
  id: string;
  type: "page" | "section_def" | "collection" | "entry";
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
