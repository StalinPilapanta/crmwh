import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/encryption";
import { listFiles, getFileContent, refreshAccessToken, type DriveFile } from "./client";
import { parseSheetsCSV, parseDocText } from "./parser";
import { indexDocument } from "@/lib/ai/rag";

interface GDriveSyncConfig {
  refresh_token: string;
  access_token: string;
  folder_id?: string;
  openai_api_key: string;
}

/**
 * Syncs documents from a Google Drive folder into the knowledge base.
 * Called by the gdrive-sync cron job.
 */
export async function syncGoogleDrive(
  tenantId: string,
  agentId: string,
  configEncrypted: string
): Promise<{ synced: number; errors: number }> {
  const supabase = createAdminClient();
  const config: GDriveSyncConfig = JSON.parse(decrypt(configEncrypted));

  let accessToken = config.access_token;

  // Try to refresh the access token
  try {
    const refreshed = await refreshAccessToken(config.refresh_token);
    accessToken = refreshed.access_token;
  } catch {
    // Use existing token, might still be valid
  }

  // List files from the configured folder
  const { files } = await listFiles(accessToken, config.folder_id);

  // Filter to supported file types
  const supportedTypes = [
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.google-apps.document",
    "text/plain",
    "text/csv",
  ];

  const supportedFiles = files.filter((f) =>
    supportedTypes.includes(f.mimeType)
  );

  let synced = 0;
  let errors = 0;

  for (const file of supportedFiles) {
    try {
      await syncFile(supabase, tenantId, agentId, accessToken, file, config.openai_api_key);
      synced++;
    } catch (error) {
      console.error(`GDrive sync error for file ${file.name}:`, error);
      errors++;
    }
  }

  return { synced, errors };
}

async function syncFile(
  supabase: ReturnType<typeof createAdminClient>,
  tenantId: string,
  agentId: string,
  accessToken: string,
  file: DriveFile,
  openaiApiKey: string
) {
  // Check if document already exists and if it's been modified
  const { data: existingDoc } = await supabase
    .from("knowledge_docs")
    .select("id, source_url")
    .eq("tenant_id", tenantId)
    .eq("agent_id", agentId)
    .eq("source_url", `gdrive://${file.id}`)
    .single();

  // Get file content
  const content = await getFileContent(accessToken, file.id, file.mimeType);

  // Parse content based on type
  let parsedText: string;
  if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
    parsedText = parseSheetsCSV(content, file.name);
  } else {
    parsedText = parseDocText(content, file.name);
  }

  if (!parsedText.trim()) return;

  if (existingDoc) {
    // Delete old chunks and re-index
    await supabase
      .from("knowledge_chunks")
      .delete()
      .eq("document_id", existingDoc.id);

    await indexDocument(tenantId, existingDoc.id, parsedText, openaiApiKey);

    await supabase
      .from("knowledge_docs")
      .update({ status: "ready" })
      .eq("id", existingDoc.id);
  } else {
    // Create new document record
    const { data: doc } = await supabase
      .from("knowledge_docs")
      .insert({
        tenant_id: tenantId,
        agent_id: agentId,
        name: file.name,
        source_type: "google_sheets",
        source_url: `gdrive://${file.id}`,
        status: "processing",
      })
      .select("id")
      .single();

    if (doc) {
      await indexDocument(tenantId, doc.id, parsedText, openaiApiKey);
    }
  }
}
