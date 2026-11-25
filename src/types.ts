export type GroupId = 'tiles' | 'granite' | 'sanitary' | 'accessories' | 'kadappa';

export type CalcKind = 'box' | 'sqft' | 'pcs';

export type SizeUnit = 'ft' | 'in' | 'mm' | 'cm';

export type SizeMode = 'lxw' | 'direct';

export type ActiveTab = 'estimate' | 'saved' | 'rates';

export interface GroupConfig {
  label: string;
  short: string;
  kind: CalcKind;
}

export interface Product {
  id: number;
  code: string;
  name: string;
  group: GroupId;
  sqftPerBox: number;
  rate: number;
  chk?: boolean;
  pics?: number;
}

export interface EstimateItem {
  room: string;
  group: GroupId;
  kind: CalcKind;
  name: string;
  sizeText: string;
  unit: string;
  qty: number;
  unitRate: number;
  amount: number;
  rateText: string;
  boxes: number;
  // Optional metadata for re-editing an item
  productId?: number;
  baseRate?: number;
  sqftPerBox?: number;
  picsPerBox?: number;
  sizeMode?: SizeMode;
  sizeUnit?: SizeUnit;
  lenVal?: string;
  widVal?: string;
  directVal?: string;
}

export interface SavedBill {
  id: number;
  ts: number;
  date: string;
  custName: string;
  custPhone: string;
  salesman: string;
  rooms: EstimateItem[];
  totalBoxes: number;
  totalAmount: number;
}

export interface DraftState {
  cust: string;
  phone: string;
  salesman: string;
  rooms: EstimateItem[];
  billId: number | null;
  ts: number;
}

export type DialogState =
  | { type: 'none' }
  | {
      type: 'confirm';
      title: string;
      message: string;
      confirmLabel?: string;
      danger?: boolean;
      onConfirm: () => void;
    }
  | {
      type: 'prompt';
      title: string;
      message: string;
      placeholder?: string;
      inputType?: 'text' | 'number';
      initialValue: string;
      confirmLabel?: string;
      onConfirm: (value: string) => void;
    }
  | {
      type: 'billPreview';
      imageUrl: string;
      fileName: string;
      blob: Blob;
    }
  | {
      type: 'printPreview';
    };
