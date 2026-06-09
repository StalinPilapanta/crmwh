/**
 * Script para probar el webhook localmente.
 * Ejecutar: npx tsx scripts/test-webhook.ts
 */

import { createHmac } from "crypto";

const WEBHOOK_URL = "https://crmwh.vercel.app/api/whatsapp/webhook";
const APP_SECRET = "xxx"; // Mismo valor que WHATSAPP_APP_SECRET en .env.local

const payload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "123456789",
      changes: [
        {
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15556569513",
              phone_number_id: "1201335609722299",
            },
            contacts: [
              {
                profile: { name: "Test" },
                wa_id: "593995276111",
              },
            ],
            messages: [
              {
                from: "593995276111",
                id: "wamid.test123",
                timestamp: String(Math.floor(Date.now() / 1000)),
                type: "text",
                text: { body: "Hola, quiero información sobre sus productos" },
              },
            ],
          },
          field: "messages",
        },
      ],
    },
  ],
};

async function main() {
  const body = JSON.stringify(payload);

  // Generate HMAC signature
  const signature = "sha256=" + createHmac("sha256", APP_SECRET).update(body).digest("hex");

  console.log("Sending test webhook to:", WEBHOOK_URL);
  console.log("Phone Number ID:", "1201335609722299");
  console.log("From:", "593995276111");
  console.log("Message:", "Hola, quiero información sobre sus productos");
  console.log("---");

  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hub-signature-256": signature,
    },
    body,
  });

  console.log("Response status:", response.status);
  const text = await response.text();
  try {
    console.log("Response body:", JSON.parse(text));
  } catch {
    console.log("Response (raw):", text.slice(0, 200));
  }
}

main().catch(console.error);
