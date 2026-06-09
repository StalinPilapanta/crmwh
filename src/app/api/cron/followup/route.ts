import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/encryption";
import { sendTextMessage } from "@/lib/whatsapp/client";
import { notifyTenantUsers } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // --- Handoff timeout check ---
  // Find conversations waiting for handoff > 3 minutes without being accepted
  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();

  const { data: staleHandoffs } = await supabase
    .from("conversations")
    .select("id, tenant_id, whatsapp_session_id, leads(phone_number)")
    .eq("status", "waiting_handoff")
    .lt("handoff_requested_at", threeMinutesAgo);

  if (staleHandoffs && staleHandoffs.length > 0) {
    for (const conv of staleHandoffs) {
      try {
        const leads = conv.leads as unknown as { phone_number: string } | { phone_number: string }[] | null;
        const lead = Array.isArray(leads) ? leads[0] : leads;

        // Send reassurance message to the lead
        if (lead && conv.whatsapp_session_id) {
          const { data: session } = await supabase
            .from("whatsapp_sessions")
            .select("phone_number_id, access_token_encrypted")
            .eq("id", conv.whatsapp_session_id)
            .eq("status", "active")
            .single();

          if (session) {
            const accessToken = decrypt(session.access_token_encrypted);
            await sendTextMessage(
              session.phone_number_id,
              accessToken,
              lead.phone_number,
              "Un momento, estamos conectándote con un asesor..."
            );

            // Save the message in DB
            await supabase.from("messages").insert({
              conversation_id: conv.id,
              tenant_id: conv.tenant_id,
              sender_type: "system",
              content: "Un momento, estamos conectándote con un asesor...",
              message_type: "text",
              status: "sent",
            });
          }
        }

        // Create notification for supervisors
        await notifyTenantUsers(
          conv.tenant_id,
          ["supervisor", "admin"],
          "handoff_timeout",
          "Handoff sin atender",
          "Una conversación lleva más de 3 minutos esperando ser atendida",
          { conversation_id: conv.id }
        );
      } catch (error) {
        console.error(`Handoff timeout processing failed for ${conv.id}:`, error);
      }
    }
  }

  // Get pending tasks that are due
  const { data: tasks, error } = await supabase
    .from("follow_up_tasks")
    .select("*, follow_up_sequences(*), conversations(whatsapp_session_id, leads(phone_number)), leads(phone_number)")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (error || !tasks) {
    return NextResponse.json({ processed: 0, error: error?.message });
  }

  let processed = 0;
  let failed = 0;

  for (const task of tasks) {
    try {
      const sequence = task.follow_up_sequences as Record<string, unknown>;
      const steps = (sequence?.steps as { message: string; delay_minutes: number }[]) || [];
      const currentStep = steps[task.step_index];

      if (!currentStep) {
        await supabase
          .from("follow_up_tasks")
          .update({ status: "cancelled" })
          .eq("id", task.id);
        continue;
      }

      // Check business hours if configured
      if (sequence?.business_hours_only) {
        const hour = new Date().getHours();
        if (hour < 8 || hour >= 18) {
          // Reschedule to next business hour
          continue;
        }
      }

      // Get WhatsApp session for this conversation
      const conv = task.conversations as Record<string, unknown>;
      const sessionId = conv?.whatsapp_session_id as string;

      if (sessionId) {
        const { data: session } = await supabase
          .from("whatsapp_sessions")
          .select("phone_number_id, access_token_encrypted")
          .eq("id", sessionId)
          .eq("status", "active")
          .single();

        if (session) {
          const lead = task.leads as { phone_number: string } | null;
          if (lead) {
            const accessToken = decrypt(session.access_token_encrypted);
            await sendTextMessage(
              session.phone_number_id,
              accessToken,
              lead.phone_number,
              currentStep.message
            );

            // Save message in DB
            await supabase.from("messages").insert({
              conversation_id: task.conversation_id,
              tenant_id: task.tenant_id,
              sender_type: "ai",
              content: currentStep.message,
              message_type: "text",
              status: "sent",
            });
          }
        }
      }

      // Mark task as executed
      await supabase
        .from("follow_up_tasks")
        .update({ status: "executed", executed_at: now })
        .eq("id", task.id);

      // Schedule next step if available
      const nextStepIndex = task.step_index + 1;
      if (nextStepIndex < steps.length) {
        const nextStep = steps[nextStepIndex];
        const nextScheduled = new Date(
          Date.now() + (nextStep.delay_minutes || 60) * 60 * 1000
        ).toISOString();

        await supabase.from("follow_up_tasks").insert({
          tenant_id: task.tenant_id,
          sequence_id: task.sequence_id,
          lead_id: task.lead_id,
          conversation_id: task.conversation_id,
          step_index: nextStepIndex,
          scheduled_at: nextScheduled,
        });
      }

      processed++;
    } catch (error) {
      console.error(`Follow-up task ${task.id} failed:`, error);
      failed++;

      // Update retry count
      const retryCount = (task.retry_count || 0) + 1;
      if (retryCount >= 3) {
        await supabase
          .from("follow_up_tasks")
          .update({
            status: "failed",
            retry_count: retryCount,
            error_message: String(error),
          })
          .eq("id", task.id);
      } else {
        await supabase
          .from("follow_up_tasks")
          .update({ retry_count: retryCount })
          .eq("id", task.id);
      }
    }
  }

  return NextResponse.json({ processed, failed, total: tasks.length });
}
