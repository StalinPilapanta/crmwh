import type {
  DropiProduct,
  DropiOrder,
  DropiPaginatedResponse,
  CreateOrderPayload,
} from "./types";

const DROPI_API_URL = "https://api.dropi.co/api/v1";
const REQUEST_TIMEOUT = 60000; // 60s timeout

interface DropiClientConfig {
  apiKey: string;
  storeId: string;
}

export class DropiClient {
  private apiKey: string;
  private storeId: string;

  constructor(config: DropiClientConfig) {
    this.apiKey = config.apiKey;
    this.storeId = config.storeId;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${DROPI_API_URL}/stores/${this.storeId}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `Dropi API error: ${response.status} ${response.statusText} - ${errorBody}`
      );
    }

    return response.json();
  }

  /**
   * Fetch products with pagination
   */
  async getProducts(
    page: number = 1,
    limit: number = 50
  ): Promise<DropiPaginatedResponse<DropiProduct>> {
    return this.request<DropiPaginatedResponse<DropiProduct>>(
      `/products?page=${page}&limit=${limit}`
    );
  }

  /**
   * Create a new order in Dropi
   */
  async createOrder(payload: CreateOrderPayload): Promise<DropiOrder> {
    const response = await this.request<{ data: DropiOrder }>("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  /**
   * Get order status by order ID
   */
  async getOrderStatus(orderId: number): Promise<DropiOrder> {
    const response = await this.request<{ data: DropiOrder }>(
      `/orders/${orderId}`
    );
    return response.data;
  }
}
