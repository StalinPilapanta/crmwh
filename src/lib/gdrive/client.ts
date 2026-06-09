const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_API_URL = "https://www.googleapis.com/drive/v3";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];

/**
 * Generates the OAuth authorization URL for Google Drive.
 */
export function getAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });

  if (state) {
    params.set("state", state);
  }

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchanges an authorization code for access/refresh tokens.
 */
export async function exchangeCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Google OAuth error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Refreshes an expired access token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh Google access token");
  }

  return response.json();
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
}

/**
 * Lists files in a Google Drive folder.
 */
export async function listFiles(
  accessToken: string,
  folderId?: string,
  pageToken?: string
): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
  const params = new URLSearchParams({
    pageSize: "100",
    fields: "nextPageToken,files(id,name,mimeType,modifiedTime,size)",
    orderBy: "modifiedTime desc",
  });

  let query = "trashed=false";
  if (folderId) {
    query += ` and '${folderId}' in parents`;
  }
  params.set("q", query);

  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  const response = await fetch(`${GOOGLE_API_URL}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google Drive API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Gets the content of a file from Google Drive.
 * For Google Sheets, exports as CSV. For other files, downloads content.
 */
export async function getFileContent(
  accessToken: string,
  fileId: string,
  mimeType: string
): Promise<string> {
  let url: string;

  if (mimeType === "application/vnd.google-apps.spreadsheet") {
    // Export Google Sheets as CSV
    url = `${GOOGLE_API_URL}/files/${fileId}/export?mimeType=text/csv`;
  } else if (mimeType === "application/vnd.google-apps.document") {
    // Export Google Docs as plain text
    url = `${GOOGLE_API_URL}/files/${fileId}/export?mimeType=text/plain`;
  } else {
    // Download other file types
    url = `${GOOGLE_API_URL}/files/${fileId}?alt=media`;
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to get file content: ${response.status}`);
  }

  return response.text();
}
