import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Splits text into chunks with overlap for better context preservation.
 */
export function chunkText(
  text: string,
  maxTokens: number = 500,
  overlap: number = 100
): string[] {
  // Approximate: 1 token ≈ 4 characters
  const maxChars = maxTokens * 4;
  const overlapChars = overlap * 4;

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChars;

    // Try to break at a sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf(".", end);
      const lastNewline = text.lastIndexOf("\n", end);
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > start + maxChars * 0.5) {
        end = breakPoint + 1;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    start = end - overlapChars;
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * Generates embeddings using OpenAI's embedding API
 */
export async function generateEmbeddings(
  texts: string[],
  apiKey: string
): Promise<number[][]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embeddings API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data.map((item: { embedding: number[] }) => item.embedding);
}

/**
 * Searches knowledge base using vector similarity
 */
export async function searchKnowledge(
  query: string,
  tenantId: string,
  agentId: string,
  apiKey: string,
  topK: number = 5,
  threshold: number = 0.7
): Promise<{ content: string; similarity: number }[]> {
  // Generate query embedding
  const [queryEmbedding] = await generateEmbeddings([query], apiKey);

  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: queryEmbedding,
    match_tenant_id: tenantId,
    match_agent_id: agentId,
    match_threshold: threshold,
    match_count: topK,
  });

  if (error) {
    console.error("Knowledge search error:", error);
    return [];
  }

  return (data || []).map((row: { content: string; similarity: number }) => ({
    content: row.content,
    similarity: row.similarity,
  }));
}

/**
 * Indexes a document by chunking and embedding it
 */
export async function indexDocument(
  tenantId: string,
  documentId: string,
  text: string,
  apiKey: string
): Promise<number> {
  const chunks = chunkText(text);
  const supabase = createAdminClient();

  // Process in batches of 20
  const batchSize = 20;
  let totalChunks = 0;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await generateEmbeddings(batch, apiKey);

    const rows = batch.map((content, idx) => ({
      tenant_id: tenantId,
      document_id: documentId,
      content,
      embedding: embeddings[idx],
      chunk_index: i + idx,
    }));

    const { error } = await supabase.from("knowledge_chunks").insert(rows);
    if (error) {
      console.error(`Error indexing batch ${i}:`, error);
      throw error;
    }

    totalChunks += batch.length;
  }

  // Update document chunk count
  await supabase
    .from("knowledge_docs")
    .update({ chunk_count: totalChunks, status: "ready" })
    .eq("id", documentId);

  return totalChunks;
}

/**
 * Deletes all chunks for a document
 */
export async function deleteDocumentChunks(documentId: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from("knowledge_chunks")
    .delete()
    .eq("document_id", documentId);
}
