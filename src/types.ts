export type TableStatus = 'Empty' | 'Serving' | 'Unpaid' | 'Paid' | 'Occupied';

export type ItemSize = 'S' | 'M' | 'L';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  image: string;
  category?: string;
}

export interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  note?: string;
}

export interface Table {
  id: number;
  status: TableStatus;
  currentOrder: OrderItem[];
  totalItems?: number;
  totalPrice?: number;
}

export interface PaymentRecord {
  id: string;
  tableId: number;
  items: OrderItem[];
  total: number;
  timestamp: number;
}
