export interface DropiProduct {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  images: string[];
  category: string | null;
  active: boolean;
  sku: string | null;
  weight: number | null;
  created_at: string;
  updated_at: string;
}

export interface DropiOrder {
  id: number;
  order_number: string;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled" | "returned";
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_city: string;
  customer_department: string;
  products: DropiOrderProduct[];
  total: number;
  shipping_cost: number;
  notes: string | null;
  tracking_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface DropiOrderProduct {
  product_id: number;
  name: string;
  quantity: number;
  price: number;
}

export interface CreateOrderPayload {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_city: string;
  customer_department: string;
  products: { product_id: number; quantity: number }[];
  notes?: string;
}

export interface DropiPaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  last_page: number;
}
