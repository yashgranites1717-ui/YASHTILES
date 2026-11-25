import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, Pencil, ReceiptText, Tags } from 'lucide-react';
import { AppDialog } from './components/AppDialog';
import { EstimateTab } from './components/EstimateTab';
import { RatesTab } from './components/RatesTab';
import { SavedBillsTab } from './components/SavedBillsTab';
import type {
  ActiveTab,
  DialogState,
  DraftState,
  EstimateItem,
  GroupId,
  Product,
  SavedBill,
} from './types';
import {
  STORAGE_KEYS,
  fdate,
  loadInitialProducts,
  loadJson,
  normalizeBill,
  normalizeRoom,
  storeJson,
} from './utils/storage';

const DEFAULT_SHOP_NAME = 'यश टाईल्स अँड ग्रॅनाईट';

export default function App() {
  const [shopName, setShopName] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.shop) || DEFAULT_SHOP_NAME;
    } catch {
      return DEFAULT_SHOP_NAME;
    }
  });

  const [products, setProducts] = useState<Product[]>(() => loadInitialProducts());

  const [savedBills, setSavedBills] = useState<SavedBill[]>(() => {
    const raw = loadJson<Array<Partial<SavedBill> & Record<string, unknown>>>(
      STORAGE_KEYS.bills,
      []
    );
    return Array.isArray(raw) ? raw.map(normalizeBill) : [];
  });

  const initialDraft = useMemo(
    () => loadJson<DraftState | null>(STORAGE_KEYS.draft, null),
    []
  );

  const [custName, setCustName] = useState(() => initialDraft?.cust || '');
  const [custPhone, setCustPhone] = useState(() => initialDraft?.phone || '');
  const [salesman, setSalesman] = useState(() => {
    if (initialDraft?.salesman) return initialDraft.salesman;
    try {
      return localStorage.getItem(STORAGE_KEYS.salesman) || '';
    } catch {
      return '';
    }
  });
  const [rooms, setRooms] = useState<EstimateItem[]>(() =>
    Array.isArray(initialDraft?.rooms)
      ? initialDraft.rooms.map((r) => normalizeRoom(r as unknown as Record<string, unknown>))
      : []
  );
  const [currentBillId, setCurrentBillId] = useState<number | null>(
    () => initialDraft?.billId || null
  );
  const [slipTs, setSlipTs] = useState<number>(() => initialDraft?.ts || Date.now());

  const [salesmenHistory, setSalesmenHistory] = useState<string[]>(() => {
    const stored = loadJson<string[]>(STORAGE_KEYS.salesmen, []);
    const set = new Set(Array.isArray(stored) ? stored : []);
    savedBills.forEach((b) => {
      if (b.salesman) set.add(b.salesman);
    });
    return [...set];
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('estimate');
  const [prefillProductDraft, setPrefillProductDraft] = useState<{
    group: GroupId;
    name: string;
  } | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const [toastMsg, setToastMsg] = useState('');
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(''), 2600);
  }, []);

  // Sync document title
  useEffect(() => {
    document.title = `${shopName} — Estimate & Calculator`;
  }, [shopName]);

  // Request persistent storage on mount
  useEffect(() => {
    try {
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(() => {});
      }
    } catch {
      // ignore
    }
  }, []);

  // Auto-save draft whenever current estimate changes
  useEffect(() => {
    const draft: DraftState = {
      cust: custName,
      phone: custPhone,
      salesman,
      rooms,
      billId: currentBillId,
      ts: slipTs,
    };
    storeJson(STORAGE_KEYS.draft, draft);
  }, [custName, custPhone, salesman, rooms, currentBillId, slipTs]);

  const handleSalesmanChange = (val: string) => {
    setSalesman(val);
    try {
      localStorage.setItem(STORAGE_KEYS.salesman, val.trim());
    } catch {
      // ignore
    }
  };

  const handleEditShopName = () => {
    setDialog({
      type: 'prompt',
      title: 'दुकानाचे नाव बदला',
      message: 'तुमच्या दुकानाचे किंवा शोरूमचे नाव टाका:',
      placeholder: DEFAULT_SHOP_NAME,
      initialValue: shopName,
      confirmLabel: 'सेव्ह करा',
      onConfirm: (val) => {
        const trimmed = val.trim();
        if (!trimmed) return;
        setShopName(trimmed);
        storeJson(STORAGE_KEYS.shop, trimmed);
        showToast('दुकानाचे नाव अपडेट झाले');
      },
    });
  };

  const handleSaveBill = () => {
    if (!rooms.length) {
      showToast('सेव्ह करण्यासाठी किमान एक वस्तू जोडा');
      return;
    }
    const ts = currentBillId ? slipTs : Date.now();
    const id = currentBillId || ts;
    const totalBoxes = rooms.reduce((s, r) => s + (r.kind === 'box' ? r.qty : 0), 0);
    const totalAmount = rooms.reduce((s, r) => s + r.amount, 0);
    const trimmedSalesman = salesman.trim();

    const bill: SavedBill = {
      id,
      ts,
      date: fdate(ts),
      custName: custName.trim() || 'Walk-in Customer',
      custPhone: custPhone.trim(),
      salesman: trimmedSalesman,
      rooms: JSON.parse(JSON.stringify(rooms)) as EstimateItem[],
      totalBoxes,
      totalAmount,
    };

    const existsIdx = savedBills.findIndex((b) => b.id === id);
    const nextBills =
      existsIdx >= 0
        ? savedBills.map((b, i) => (i === existsIdx ? bill : b))
        : [bill, ...savedBills];

    setSavedBills(nextBills);
    setCurrentBillId(id);
    setSlipTs(ts);

    if (trimmedSalesman) {
      const nextHistory = Array.from(new Set([...salesmenHistory, trimmedSalesman]));
      setSalesmenHistory(nextHistory);
      storeJson(STORAGE_KEYS.salesmen, nextHistory);
    }

    if (storeJson(STORAGE_KEYS.bills, nextBills)) {
      showToast(existsIdx >= 0 ? 'Estimate अपडेट झाले' : 'Estimate सेव्ह झाले');
    } else {
      showToast('सेव्ह करता आले नाही! बॅकअप घ्या');
    }
  };

  const handleClearEstimate = () => {
    setRooms([]);
    setCurrentBillId(null);
    setSlipTs(Date.now());
    setCustName('');
    setCustPhone('');
    showToast('नवीन कस्टमर सुरू');
  };

  const handleLoadBill = (b: SavedBill) => {
    setCustName(b.custName === 'Walk-in Customer' ? '' : b.custName);
    setCustPhone(b.custPhone || '');
    if (b.salesman) setSalesman(b.salesman);
    setRooms(JSON.parse(JSON.stringify(b.rooms)) as EstimateItem[]);
    setCurrentBillId(b.id);
    setSlipTs(b.ts);
    setActiveTab('estimate');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Bill उघडले: ${b.custName}`);
  };

  const handleDeleteBill = (id: number) => {
    if (currentBillId === id) setCurrentBillId(null);
    const nextBills = savedBills.filter((b) => b.id !== id);
    setSavedBills(nextBills);
    storeJson(STORAGE_KEYS.bills, nextBills);
    showToast('Estimate डिलीट झाले');
  };

  const handleUpdateProductFromEstimate = (
    productId: number,
    rate: number,
    sqftPerBox?: number,
    pics?: number
  ) => {
    const next = products.map((p) => {
      if (p.id !== productId) return p;
      return {
        ...p,
        rate,
        ...(sqftPerBox && sqftPerBox > 0 ? { sqftPerBox, chk: false } : {}),
        ...(pics && pics > 0 ? { pics } : {}),
      };
    });
    setProducts(next);
    storeJson(STORAGE_KEYS.products, next);
  };

  const handleSaveProduct = (input: Omit<Product, 'id'> & { id?: number }): boolean => {
    let updated = false;
    let next: Product[];

    if (input.id) {
      updated = true;
      next = products.map((p) => (p.id === input.id ? { ...p, ...input, id: p.id } : p));
    } else {
      const existing = products.find(
        (p) => p.group === input.group && p.name.toLowerCase() === input.name.toLowerCase()
      );
      if (existing) {
        updated = true;
        next = products.map((p) =>
          p.id === existing.id
            ? {
                ...p,
                code: input.code || p.code,
                rate: input.rate,
                sqftPerBox: input.sqftPerBox || p.sqftPerBox,
                pics: input.pics || p.pics,
                chk: false,
              }
            : p
        );
      } else {
        next = [{ ...input, id: Date.now() }, ...products];
      }
    }

    setProducts(next);
    storeJson(STORAGE_KEYS.products, next);
    return updated;
  };

  const handleQuickUpdateProduct = (id: number, patch: Partial<Product>) => {
    const next = products.map((p) => (p.id === id ? { ...p, ...patch } : p));
    setProducts(next);
    storeJson(STORAGE_KEYS.products, next);
  };

  const handleDeleteProduct = (id: number) => {
    const next = products.filter((p) => p.id !== id);
    setProducts(next);
    storeJson(STORAGE_KEYS.products, next);
    showToast('प्रोडक्ट काढला');
  };

  const handleBulkUpdateRates = (ids: number[], rate: number) => {
    const idSet = new Set(ids);
    const next = products.map((p) => (idSet.has(p.id) ? { ...p, rate } : p));
    setProducts(next);
    storeJson(STORAGE_KEYS.products, next);
  };

  const handleReplaceAllProducts = (list: Product[], newShop?: string) => {
    setProducts(list);
    storeJson(STORAGE_KEYS.products, list);
    if (newShop) {
      setShopName(newShop);
      storeJson(STORAGE_KEYS.shop, newShop);
    }
  };

  const handleRestoreBackup = (data: { shop?: string; products: Product[]; bills: SavedBill[] }) => {
    setProducts(data.products);
    setSavedBills(data.bills);
    storeJson(STORAGE_KEYS.products, data.products);
    storeJson(STORAGE_KEYS.bills, data.bills);
    if (data.shop) {
      setShopName(data.shop);
      storeJson(STORAGE_KEYS.shop, data.shop);
    }
    const nextSalesmen = new Set(salesmenHistory);
    data.bills.forEach((b) => {
      if (b.salesman) nextSalesmen.add(b.salesman);
    });
    setSalesmenHistory([...nextSalesmen]);
    showToast('बॅकअप रिस्टोअर झाला');
  };

  const handleQuickAddProductFromSearch = (group: GroupId, searchName: string) => {
    setPrefillProductDraft({ group, name: searchName });
    setActiveTab('rates');
  };

  const closeDialog = () => {
    if (dialog.type === 'billPreview') {
      URL.revokeObjectURL(dialog.imageUrl);
    }
    setDialog({ type: 'none' });
  };

  const switchTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#f4f6f5] text-[#182220] pb-20 lg:pb-10">
      {/* Sticky Top Header (Clean 3-zone contract) */}
      <header className="sticky top-0 z-40 h-14 bg-[#0f5c4c] text-white border-b border-[#0b4a3d] no-print">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={handleEditShopName}
            title="दुकानाचे नाव बदला"
            className="text-base sm:text-lg font-extrabold tracking-tight text-white whitespace-nowrap truncate max-w-[230px] sm:max-w-xs flex items-center gap-1.5 hover:opacity-90 text-left"
          >
            <span className="truncate">{shopName}</span>
            <Pencil className="w-3.5 h-3.5 shrink-0 opacity-80" />
          </button>

          {/* Zone 2: Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold">
            <button
              type="button"
              onClick={() => switchTab('estimate')}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                activeTab === 'estimate'
                  ? 'text-white border-white'
                  : 'text-emerald-100/80 border-transparent hover:text-white'
              }`}
            >
              नवीन Estimate
            </button>
            <button
              type="button"
              onClick={() => switchTab('saved')}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                activeTab === 'saved'
                  ? 'text-white border-white'
                  : 'text-emerald-100/80 border-transparent hover:text-white'
              }`}
            >
              सेव्ह Bills ({savedBills.length})
            </button>
            <button
              type="button"
              onClick={() => switchTab('rates')}
              className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                activeTab === 'rates'
                  ? 'text-white border-white'
                  : 'text-emerald-100/80 border-transparent hover:text-white'
              }`}
            >
              रेट लिस्ट ({products.length})
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <button
            type="button"
            onClick={activeTab === 'estimate' ? handleSaveBill : () => switchTab('estimate')}
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-white text-[#0f5c4c] text-xs font-extrabold hover:bg-emerald-50 transition-colors whitespace-nowrap shrink-0"
          >
            {activeTab === 'estimate' ? 'Estimate सेव्ह' : 'नवीन Estimate'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {activeTab === 'estimate' && (
          <EstimateTab
            shopName={shopName}
            products={products}
            salesmenHistory={salesmenHistory}
            custName={custName}
            custPhone={custPhone}
            salesman={salesman}
            rooms={rooms}
            currentBillId={currentBillId}
            slipTs={slipTs}
            onCustNameChange={setCustName}
            onCustPhoneChange={setCustPhone}
            onSalesmanChange={handleSalesmanChange}
            onRoomsChange={setRooms}
            onSaveBill={handleSaveBill}
            onClearEstimate={handleClearEstimate}
            onUpdateProductMaster={handleUpdateProductFromEstimate}
            onQuickAddProduct={handleQuickAddProductFromSearch}
            onToast={showToast}
            onOpenDialog={setDialog}
          />
        )}

        {activeTab === 'saved' && (
          <SavedBillsTab
            shopName={shopName}
            products={products}
            savedBills={savedBills}
            hasUnsavedRooms={rooms.length > 0}
            currentBillId={currentBillId}
            onLoadBill={handleLoadBill}
            onDeleteBill={handleDeleteBill}
            onRestoreBackup={handleRestoreBackup}
            onToast={showToast}
            onOpenDialog={setDialog}
          />
        )}

        {activeTab === 'rates' && (
          <RatesTab
            shopName={shopName}
            products={products}
            prefillDraft={prefillProductDraft}
            onClearPrefill={() => setPrefillProductDraft(null)}
            onSaveProduct={handleSaveProduct}
            onQuickUpdateProduct={handleQuickUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onBulkUpdateRates={handleBulkUpdateRates}
            onReplaceAllProducts={handleReplaceAllProducts}
            onToast={showToast}
            onOpenDialog={setDialog}
          />
        )}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 backdrop-blur-md border-t border-[#dce3e0] grid grid-cols-3 no-print">
        <button
          type="button"
          onClick={() => switchTab('estimate')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors ${
            activeTab === 'estimate' ? 'text-[#0f5c4c]' : 'text-[#64748b]'
          }`}
        >
          <ReceiptText className="w-5 h-5" />
          <span>नवीन Estimate</span>
        </button>
        <button
          type="button"
          onClick={() => switchTab('saved')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors ${
            activeTab === 'saved' ? 'text-[#0f5c4c]' : 'text-[#64748b]'
          }`}
        >
          <FolderOpen className="w-5 h-5" />
          <span>सेव्ह Bills</span>
        </button>
        <button
          type="button"
          onClick={() => switchTab('rates')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors ${
            activeTab === 'rates' ? 'text-[#0f5c4c]' : 'text-[#64748b]'
          }`}
        >
          <Tags className="w-5 h-5" />
          <span>रेट लिस्ट</span>
        </button>
      </nav>

      {/* In-App Dialogs, A4 Print Preview & PNG Bill Preview */}
      <AppDialog
        dialog={dialog}
        printData={{
          shopName,
          custName,
          custPhone,
          salesman,
          slipTs,
          billId: currentBillId,
          rooms,
        }}
        onClose={closeDialog}
        onToast={showToast}
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-20 lg:bottom-6 z-50 bg-[#182220] text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-lg max-w-[90vw] text-center no-print"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
