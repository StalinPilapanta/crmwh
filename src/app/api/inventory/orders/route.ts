import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/encryption";
import { DropiClient } from "@/lib/dropi/client";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const status = searchParams.get("status") || "";
  const offset = (page - 1) * limit;

  let query = supabase
    .from("orders")
    .select("*", { count: "exact" });

  if (status) {
    query = query.eq("status", status);
  }

  const { data: orders, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: "Error al obtener órdenes" }, { status: 500 });
  }

  return NextResponse.json({
    orders,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant no encontrado" }, { status: 400 });
  }

  const body = await request.json();
  const { customerName, customerPhone, customerAddress, customerCity, customerDepartment, products, notes, leadId } = body;

  if (!customerName || !customerPhone || !customerAddress || !customerCity || !customerDepartment || !products?.length) {
    return NextResponse.json(
      { error: "Datos del cliente y productos son requeridos" },
      { status: 400 }
    );
  }

  // Get Dropi integration config
  const adminClient = createAdminClient();
  const { data: integration } = await adminClient
    .from("integrations")
    .select("config_encrypted")
    .eq("tenant_id", tenantId)
    .eq("type", "dropi")
    .eq("status", "connected")
    .single();

  if (!integration?.config_encrypted) {
    return NextResponse.json(
      { error: "Integración con Dropi no configurada" },
      { status: 400 }
    );
  }

  const config = JSON.parse(decrypt(integration.config_encrypted));
  const client = new DropiClient({
    apiKey: config.api_key,
    storeId: config.store_id,
  });

  try {
    // Create order in Dropi
    const dropiOrder = await client.createOrder({
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      customer_city: customerCity,
      customer_department: customerDepartment,
      products: products.map((p: { productId: number; quantity: number }) => ({
        product_id: p.productId,
        quantity: p.quantity,
      })),
      notes,
    });

    // Save order in local DB
    const { data: order, error: dbError } = await adminClient
      .from("orders")
      .insert({
        tenant_id: tenantId,
        external_id: String(dropiOrder.id),
        order_number: dropiOrder.order_number,
        status: dropiOrder.status,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        customer_city: customerCity,
        total: dropiOrder.total,
        lead_id: leadId || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error saving order locally:", dbError);
      return NextResponse.json(
        { error: "Orden creada en Dropi pero error al guardar localmente" },
        { status: 500 }
      );
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear orden";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
