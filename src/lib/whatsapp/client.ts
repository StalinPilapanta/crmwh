import type { SendMessagePayload, SendMessageResponse } from "./types";

const META_API_URL = "https://graph.facebook.com/v21.0";

export async function sendTextMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string
): Promise<SendMessageResponse> {
  const payload: SendMessagePayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: text },
  };

  return sendMessage(phoneNumberId, accessToken, payload);
}

export async function sendTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  languageCode: string = "es"
): Promise<SendMessageResponse> {
  const payload: SendMessagePayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  };

  return sendMessage(phoneNumberId, accessToken, payload);
}

export async function markAsRead(
  phoneNumberId: string,
  accessToken: string,
  messageId: string
): Promise<void> {
  await fetch(`${META_API_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  });
}

async function sendMessage(
  phoneNumberId: string,
  accessToken: string,
  payload: SendMessagePayload
): Promise<SendMessageResponse> {
  const response = await fetch(`${META_API_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `WhatsApp API error: ${response.status} - ${JSON.stringify(error)}`
    );
  }

  return response.json();
}
