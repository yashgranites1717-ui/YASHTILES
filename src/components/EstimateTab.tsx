import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkCheck,
  Check,
  Copy,
  Image as ImageIcon,
  Minus,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  GROUPS,
  GROUP_ORDER,
  RATE_LABEL,
  RATE_UNIT,
  ROOM_PRESETS,
  UNITS,
  UNIT_ORDER,
} from '../data/seed';
import type {
  CalcKind,
  DialogState,
  EstimateItem,
  GroupId,
  Product,
  SizeMode,
  SizeUnit,
} from '../types';
import {
  copyToClipboard,
  fdate,
  fmt,
  fr,
  kindOf,
  picsOf,
  qtyText,
  renderBillToPngBlob,
} from '../utils/storage';
import { PrintEstimateTemplate } from './PrintEstimateTemplate';

interface EstimateTabProps {
  shopName: string;
  products: Product[];
  salesmenHistory: string[];
  custName: string;
  custPhone: string;
  salesman: string;
  rooms: EstimateItem[];
  currentBillId: number | null;
  slipTs: number;
  onCustNameChange: (val: string) => void;
  onCustPhoneChange: (val: string) => void;
  onSalesmanChange: (val: string) => void;
  onRoomsChange: (rooms: EstimateItem[]) => void;
  onSaveBill: () => void;
  onClearEstimate: () => void;
  onUpdateProductMaster: (productId: number, rate: number, sqftPerBox?: number, pics?: number) => void;
  onQuickAddProduct: (group: GroupId, searchName: string) => void;
  onToast: (msg: string) => void;
  onOpenDialog: (dialog: DialogState) => void;
}

export function EstimateTab({
  shopName,
  products,
  salesmenHistory,
  custName,
  custPhone,
  salesman,
  rooms,
  currentBillId,
  slipTs,
  onCustNameChange,
  onCustPhoneChange,
  onSalesmanChange,
  onRoomsChange,
  onSaveBill,
  onClearEstimate,
  onUpdateProductMaster,
  onQuickAddProduct,
  onToast,
  onOpenDialog,
}: EstimateTabProps) {
  const [activeGroup, setActiveGroup] = useState<GroupId>('tiles');
  const [roomName, setRoomName] = useState('Hall');
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [curRate, setCurRate] = useState(0);
  const [curSqftBox, setCurSqftBox] = useState(0);
  const [curPics, setCurPics] = useState(0);

  // Separate string states for synchronized rate inputs so decimal typing never glitches
  const [rateAStr, setRateAStr] = useState('');
  const [rateBStr, setRateBStr] = useState('');
  const [rateBoxStr, setRateBoxStr] = useState('');
  const [ratePicStr, setRatePicStr] = useState('');
  const [sqftBoxStr, setSqftBoxStr] = useState('');
  const [picsBoxStr, setPicsBoxStr] = useState('');

  const [sizeMode, setSizeMode] = useState<SizeMode>('lxw');
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>(() => {
    try {
      const saved = localStorage.getItem('ytg_unit') as SizeUnit | null;
      return saved && UNITS[saved] ? saved : 'ft';
    } catch {
      return 'ft';
    }
  });
  const [lenVal, setLenVal] = useState('');
  const [widVal, setWidVal] = useState('');
  const [directVal, setDirectVal] = useState('');
  const [qty, setQty] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [renderingImg, setRenderingImg] = useState(false);

  const currentKind: CalcKind = selectedProduct ? kindOf(selectedProduct) : GROUPS[activeGroup].kind;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Sync selectedProduct if updated in master list
  useEffect(() => {
    if (!selectedProduct) return;
    const latest = products.find((p) => p.id === selectedProduct.id);
    if (!latest) {
      setSelectedProduct(null);
      return;
    }
    if (latest !== selectedProduct) {
      setSelectedProduct(latest);
    }
  }, [products, selectedProduct]);

  const syncAllRateStrings = (
    masterRate: number,
    sqftBox: number,
    pics: number,
    kind: CalcKind,
    skip?: 'A' | 'B' | 'box' | 'pic'
  ) => {
    if (kind !== 'box') {
      if (skip !== 'A') setRateAStr(masterRate > 0 ? String(fr(masterRate)) : '');
      return;
    }
    const boxRate = sqftBox > 0 ? (masterRate / 100) * sqftBox : 0;
    if (skip !== 'A') setRateAStr(masterRate > 0 ? String(fr(masterRate)) : '');
    if (skip !== 'B') setRateBStr(masterRate > 0 ? String(fr(masterRate / 100)) : '');
    if (skip !== 'box') setRateBoxStr(boxRate > 0 ? String(fr(boxRate)) : '');
    if (skip !== 'pic') setRatePicStr(boxRate > 0 && pics > 0 ? String(fr(boxRate / pics)) : '');
  };

  const area = useMemo(() => {
    if (sizeMode === 'lxw') {
      const f = UNITS[sizeUnit].f;
      const l = parseFloat(lenVal) || 0;
      const w = parseFloat(widVal) || 0;
      return l * f * (w * f);
    }
    return parseFloat(directVal) || 0;
  }, [sizeMode, sizeUnit, lenVal, widVal, directVal]);

  const recalcQtyFromArea = (nextArea: number, sqftBox: number, kind: CalcKind) => {
    if (kind === 'box') {
      setQty(sqftBox > 0 && nextArea > 0 ? Math.ceil(nextArea / sqftBox) : 0);
    } else if (kind === 'pcs') {
      setQty((prev) => (prev > 0 ? prev : 1));
    }
  };

  const handleGroupChange = (g: GroupId) => {
    setActiveGroup(g);
    if (selectedProduct && selectedProduct.group !== g) {
      setSelectedProduct(null);
      setSearchQuery('');
      setCurRate(0);
      setCurSqftBox(0);
      setCurPics(0);
      setRateAStr('');
      setRateBStr('');
      setRateBoxStr('');
      setRatePicStr('');
      setSqftBoxStr('');
      setPicsBoxStr('');
      setQty(GROUPS[g].kind === 'pcs' ? 1 : 0);
    }
  };

  const handleSelectProduct = (p: Product) => {
    const k = kindOf(p);
    const sq = p.sqftPerBox || 0;
    const pics = picsOf(p);
    const rate = p.rate || 0;
    setSelectedProduct(p);
    setSearchQuery(p.name);
    setDropdownOpen(false);
    setCurRate(rate);
    setCurSqftBox(sq);
    setCurPics(pics);
    setSqftBoxStr(sq > 0 ? String(sq) : '');
    setPicsBoxStr(pics > 0 ? String(pics) : '');
    syncAllRateStrings(rate, sq, pics, k);
    if (k === 'box') {
      setQty(sq > 0 && area > 0 ? Math.ceil(area / sq) : 0);
    } else if (k === 'pcs') {
      setQty(1);
    } else {
      setQty(0);
    }
  };

  const handleRateAChange = (val: string) => {
    setRateAStr(val);
    const r = parseFloat(val) || 0;
    setCurRate(r);
    syncAllRateStrings(r, curSqftBox, curPics, currentKind, 'A');
  };

  const handleRateBChange = (val: string) => {
    setRateBStr(val);
    const rPerSqft = parseFloat(val) || 0;
    const r100 = Math.round(rPerSqft * 100 * 10000) / 10000;
    setCurRate(r100);
    syncAllRateStrings(r100, curSqftBox, curPics, currentKind, 'B');
  };

  const handleRateBoxChange = (val: string) => {
    setRateBoxStr(val);
    const boxR = parseFloat(val) || 0;
    if (boxR > 0 && !(curSqftBox > 0)) {
      onToast('आधी 1 Box मधील Sq.Ft टाका');
      return;
    }
    const r100 = curSqftBox > 0 ? Math.round((boxR / curSqftBox) * 100 * 10000) / 10000 : 0;
    setCurRate(r100);
    syncAllRateStrings(r100, curSqftBox, curPics, currentKind, 'box');
  };

  const handleRatePicChange = (val: string) => {
    setRatePicStr(val);
    const picR = parseFloat(val) || 0;
    if (picR > 0 && !(curSqftBox > 0 && curPics > 0)) {
      onToast('आधी 1 Box मधील Sq.Ft आणि Pic टाका');
      return;
    }
    const r100 =
      curSqftBox > 0 && curPics > 0
        ? Math.round(((picR * curPics) / curSqftBox) * 100 * 10000) / 10000
        : 0;
    setCurRate(r100);
    syncAllRateStrings(r100, curSqftBox, curPics, currentKind, 'pic');
  };

  const handleSqftBoxChange = (val: string) => {
    setSqftBoxStr(val);
    const sq = parseFloat(val) || 0;
    setCurSqftBox(sq);
    syncAllRateStrings(curRate, sq, curPics, currentKind);
    if (currentKind === 'box') {
      setQty(sq > 0 && area > 0 ? Math.ceil(area / sq) : 0);
    }
  };

  const handlePicsBoxChange = (val: string) => {
    setPicsBoxStr(val);
    const pics = parseFloat(val) || 0;
    setCurPics(pics);
    syncAllRateStrings(curRate, curSqftBox, pics, currentKind);
  };

  const handleSizeModeChange = (mode: SizeMode) => {
    setSizeMode(mode);
    const nextArea =
      mode === 'lxw'
        ? (parseFloat(lenVal) || 0) * UNITS[sizeUnit].f * ((parseFloat(widVal) || 0) * UNITS[sizeUnit].f)
        : parseFloat(directVal) || 0;
    recalcQtyFromArea(nextArea, curSqftBox, currentKind);
  };

  const handleUnitChange = (u: SizeUnit) => {
    setSizeUnit(u);
    try {
      localStorage.setItem('ytg_unit', u);
    } catch {
      // ignore
    }
    if (sizeMode === 'lxw') {
      const f = UNITS[u].f;
      const nextArea = (parseFloat(lenVal) || 0) * f * ((parseFloat(widVal) || 0) * f);
      recalcQtyFromArea(nextArea, curSqftBox, currentKind);
    }
  };

  const handleLenChange = (val: string) => {
    setLenVal(val);
    const f = UNITS[sizeUnit].f;
    const nextArea = (parseFloat(val) || 0) * f * ((parseFloat(widVal) || 0) * f);
    recalcQtyFromArea(nextArea, curSqftBox, currentKind);
  };

  const handleWidChange = (val: string) => {
    setWidVal(val);
    const f = UNITS[sizeUnit].f;
    const nextArea = (parseFloat(lenVal) || 0) * f * ((parseFloat(val) || 0) * f);
    recalcQtyFromArea(nextArea, curSqftBox, currentKind);
  };

  const handleDirectChange = (val: string) => {
    setDirectVal(val);
    recalcQtyFromArea(parseFloat(val) || 0, curSqftBox, currentKind);
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter(
      (p) =>
        p.group === activeGroup &&
        (!q || p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q))
    );
  }, [products, activeGroup, searchQuery]);

  const boxRateNow = curSqftBox > 0 ? Math.round((curRate / 100) * curSqftBox) : 0;

  const lineAmount = useMemo(() => {
    if (!selectedProduct) return 0;
    if (currentKind === 'box') return qty * boxRateNow;
    if (currentKind === 'sqft') return Math.round(area * curRate);
    return qty * curRate;
  }, [selectedProduct, currentKind, qty, boxRateNow, area, curRate]);

  const resetCalculatorInputs = () => {
    setLenVal('');
    setWidVal('');
    setDirectVal('');
    setEditingIndex(null);
    if (currentKind === 'pcs') setQty(1);
    else if (currentKind === 'box') setQty(0);
  };

  const handleAddOrUpdateItem = () => {
    if (!selectedProduct) {
      onToast('कृपया आधी वस्तू निवडा');
      setDropdownOpen(true);
      return;
    }
    const k = kindOf(selectedProduct);
    if (!(curRate > 0)) {
      onToast('कृपया रेट टाका');
      return;
    }
    if (k === 'box' && !(curSqftBox > 0)) {
      onToast('1 Box मधील Sq.Ft टाका');
      return;
    }
    if (k === 'sqft' && !(area > 0)) {
      onToast('माप (Sq.Ft) टाका');
      return;
    }
    if (k !== 'sqft' && qty <= 0) {
      onToast(k === 'box' ? 'रूमची साईज किंवा बॉक्सेस टाका' : 'नग (Quantity) टाका');
      return;
    }

    const rName = roomName.trim() || 'Room';
    const areaTxt = fr(area);
    const sizeText =
      k === 'pcs'
        ? ''
        : sizeMode === 'lxw'
          ? `${lenVal || 0}×${widVal || 0} ${UNITS[sizeUnit].s} (${areaTxt} Sq.Ft)`
          : `${areaTxt} Sq.Ft`;

    const baseMeta = {
      room: rName,
      group: selectedProduct.group,
      kind: k,
      name: selectedProduct.name,
      sizeText,
      productId: selectedProduct.id,
      baseRate: curRate,
      sqftPerBox: curSqftBox,
      picsPerBox: curPics,
      sizeMode,
      sizeUnit,
      lenVal,
      widVal,
      directVal,
    };

    let newItem: EstimateItem;
    if (k === 'box') {
      newItem = {
        ...baseMeta,
        unit: 'Box',
        qty,
        unitRate: boxRateNow,
        amount: qty * boxRateNow,
        rateText: `₹${fr(curRate)}/100 Sq.Ft (₹${fmt(boxRateNow)}/Box)`,
        boxes: qty,
      };
    } else if (k === 'sqft') {
      newItem = {
        ...baseMeta,
        unit: 'Sq.Ft',
        qty: areaTxt,
        unitRate: curRate,
        amount: Math.round(area * curRate),
        rateText: `₹${fr(curRate)}/Sq.Ft`,
        boxes: 0,
      };
    } else {
      newItem = {
        ...baseMeta,
        unit: 'नग',
        qty,
        unitRate: curRate,
        amount: Math.round(qty * curRate),
        rateText: `₹${fr(curRate)}/नग`,
        boxes: 0,
      };
    }

    if (editingIndex !== null && editingIndex >= 0 && editingIndex < rooms.length) {
      const next = [...rooms];
      next[editingIndex] = newItem;
      onRoomsChange(next);
      onToast(`अपडेट केले: ${selectedProduct.name}`);
    } else {
      onRoomsChange([...rooms, newItem]);
      onToast(`जोडले: ${selectedProduct.name}`);
    }
    resetCalculatorInputs();
  };

  const handleEditRow = (idx: number) => {
    const item = rooms[idx];
    if (!item) return;
    setEditingIndex(idx);
    setActiveGroup(item.group);
    setRoomName(item.room);

    const matched =
      (item.productId ? products.find((p) => p.id === item.productId) : undefined) ||
      products.find((p) => p.name === item.name && p.group === item.group) || {
        id: item.productId || Date.now(),
        code: '',
        name: item.name,
        group: item.group,
        sqftPerBox: item.sqftPerBox || 0,
        rate: item.baseRate || item.unitRate,
        pics: item.picsPerBox || 0,
      };

    const rate = item.baseRate ?? (item.kind === 'box' && item.sqftPerBox ? (item.unitRate / item.sqftPerBox) * 100 : item.unitRate);
    const sq = item.sqftPerBox || matched.sqftPerBox || 0;
    const pics = item.picsPerBox || picsOf(matched);

    setSelectedProduct(matched);
    setSearchQuery(matched.name);
    setDropdownOpen(false);
    setCurRate(rate);
    setCurSqftBox(sq);
    setCurPics(pics);
    setSqftBoxStr(sq > 0 ? String(sq) : '');
    setPicsBoxStr(pics > 0 ? String(pics) : '');
    syncAllRateStrings(rate, sq, pics, item.kind);

    if (item.sizeMode) setSizeMode(item.sizeMode);
    if (item.sizeUnit) setSizeUnit(item.sizeUnit);
    setLenVal(item.lenVal || '');
    setWidVal(item.widVal || '');
    setDirectVal(item.directVal || (item.kind === 'sqft' ? String(item.qty) : ''));
    setQty(item.qty);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    onToast('बदल करून "अपडेट करा" दाबा');
  };

  const totalBoxes = useMemo(
    () => rooms.reduce((s, r) => s + (r.kind === 'box' ? r.qty : 0), 0),
    [rooms]
  );
  const totalAmount = useMemo(() => rooms.reduce((s, r) => s + r.amount, 0), [rooms]);

  const handleCopyWhatsApp = async () => {
    if (!rooms.length) {
      onToast('आधी वस्तू जोडा');
      return;
    }
    const cust = custName.trim() || 'Customer';
    const phone = custPhone.trim();
    let text = `*${shopName} - ESTIMATE*\nकस्टमर: *${cust}*${phone ? ` (${phone})` : ''}\nतारीख: ${fdate(slipTs)}\n------------------\n`;
    rooms.forEach((r, i) => {
      text += `${i + 1}. *${r.room}*${r.sizeText ? ` (${r.sizeText})` : ''}\n   ${r.name}\n   ${qtyText(r)} × ₹${fmt(r.unitRate)} = *₹${fmt(r.amount)}*\n\n`;
    });
    text += `------------------\n`;
    if (totalBoxes > 0) text += `*एकूण Boxes:* ${totalBoxes}\n`;
    text += `*एकूण रक्कम:* ₹${fmt(totalAmount)}`;

    const ok = await copyToClipboard(text);
    onToast(ok ? 'कॉपी झाले! आता WhatsApp वर Paste करा' : 'कॉपी झाले नाही, पुन्हा प्रयत्न करा');
  };

  const handlePrint = () => {
    if (!rooms.length) {
      onToast('आधी वस्तू जोडा');
      return;
    }
    onOpenDialog({ type: 'printPreview' });
  };

  const handleShareBillImage = async () => {
    if (!rooms.length) {
      onToast('आधी वस्तू जोडा');
      return;
    }
    setRenderingImg(true);
    try {
      const { blob, fileName } = await renderBillToPngBlob({
        shopName,
        custName,
        custPhone,
        salesman,
        slipTs,
        billId: currentBillId,
        items: rooms,
      });
      const imageUrl = URL.createObjectURL(blob);
      onOpenDialog({ type: 'billPreview', imageUrl, fileName, blob });
    } catch {
      onToast('फोटो तयार करता आला नाही');
    } finally {
      setRenderingImg(false);
    }
  };

  const handleClearClick = () => {
    if (!rooms.length && !custName.trim() && !custPhone.trim()) {
      onClearEstimate();
      return;
    }
    onOpenDialog({
      type: 'confirm',
      title: 'नवीन कस्टमर सुरू करायचा का?',
      message: 'सध्याची यादी क्लिअर होईल. सेव्ह न केलेले Estimate जाईल.',
      confirmLabel: 'होय, क्लिअर करा',
      danger: true,
      onConfirm: () => {
        onClearEstimate();
        resetCalculatorInputs();
      },
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT WORKSPACE: Customer + Item Calculator */}
      <div className="lg:col-span-7 space-y-4 no-print">
        {/* 1. Customer Card */}
        <section className="bg-white rounded-2xl border border-[#dce3e0] p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-[#182220]">१. कस्टमर माहिती</h2>
            {currentBillId && (
              <span className="text-xs font-semibold text-[#0f5c4c]">सेव्ह केलेले Bill उघडले आहे</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#52605d] mb-1">
                कस्टमरचे नाव (Name)
              </label>
              <input
                type="text"
                value={custName}
                onChange={(e) => onCustNameChange(e.target.value)}
                placeholder="उदा. संतोष पाटील"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#cbd5d1] bg-white text-[15px] text-[#182220] focus:outline-none focus:border-[#0f5c4c]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#52605d] mb-1">
                मोबाईल नंबर (ऐच्छिक)
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={custPhone}
                onChange={(e) => onCustPhoneChange(e.target.value)}
                placeholder="98XXXXXXXX"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#cbd5d1] bg-white text-[15px] text-[#182220] tabular-nums focus:outline-none focus:border-[#0f5c4c]"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-semibold text-[#52605d] mb-1">
              विक्रेता / सेल्समन (Salesman)
            </label>
            <input
              type="text"
              list="salesman-history"
              value={salesman}
              onChange={(e) => onSalesmanChange(e.target.value)}
              placeholder="तुमचे नाव"
              autoComplete="off"
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#cbd5d1] bg-white text-[15px] text-[#182220] focus:outline-none focus:border-[#0f5c4c]"
            />
            <datalist id="salesman-history">
              {salesmenHistory.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </section>

        {/* 2. Add / Edit Item Calculator */}
        <section className="bg-white rounded-2xl border border-[#dce3e0] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-[15px] font-bold text-[#182220]">
              {editingIndex !== null ? '२. वस्तू अपडेट करा (Edit Item)' : '२. वस्तू निवडा (Add Item)'}
            </h2>
            {editingIndex !== null && (
              <button
                type="button"
                onClick={resetCalculatorInputs}
                className="text-xs font-semibold text-[#dc2626] hover:underline px-2 py-1"
              >
                एडिट रद्द करा
              </button>
            )}
          </div>

          {/* Group Selector */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-[#52605d] mb-1.5">ग्रुप (Group)</label>
            <div className="flex flex-wrap gap-1.5">
              {GROUP_ORDER.map((g) => {
                const active = activeGroup === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => handleGroupChange(g)}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#0f5c4c] text-white border-[#0f5c4c]'
                        : 'bg-[#f4f6f5] text-[#334155] border-[#dce3e0] hover:bg-[#e6f4f1]'
                    }`}
                  >
                    {GROUPS[g].short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Room Selector */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-[#52605d] mb-1.5">
              रूम / ठिकाण (Room)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {ROOM_PRESETS.map((rp) => {
                const active = roomName === rp.value;
                return (
                  <button
                    key={rp.value}
                    type="button"
                    onClick={() => setRoomName(rp.value)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#0f5c4c] text-white border-[#0f5c4c]'
                        : 'bg-[#f4f6f5] text-[#334155] border-[#dce3e0] hover:bg-[#e6f4f1]'
                    }`}
                  >
                    {rp.label}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="रूमचे नाव लिहा"
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#cbd5d1] bg-white text-[15px] text-[#182220] focus:outline-none focus:border-[#0f5c4c]"
            />
          </div>

          {/* Product Search Combobox */}
          <div className="relative mb-3" ref={searchWrapRef}>
            <label className="block text-xs font-semibold text-[#52605d] mb-1">
              {GROUPS[activeGroup].short} शोधा (Search)
            </label>
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[#64748b] absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setDropdownOpen(true);
                }}
                placeholder="नाव किंवा कोड टाईप करा..."
                autoComplete="off"
                className="w-full min-h-[46px] pl-10 pr-10 py-2 rounded-xl border border-[#cbd5d1] bg-white text-[15px] text-[#182220] focus:outline-none focus:border-[#0f5c4c]"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="शोध क्लिअर करा"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedProduct(null);
                    setDropdownOpen(true);
                  }}
                  className="absolute right-1 min-h-[40px] min-w-[40px] flex items-center justify-center text-[#64748b] hover:text-[#182220]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {dropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-[#0f5c4c] rounded-xl max-h-64 overflow-y-auto z-30 shadow-lg">
                {filteredProducts.length === 0 ? (
                  <div className="p-3 text-sm text-[#52605d] flex items-center justify-between gap-2">
                    <span>काहीही सापडले नाही.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        onQuickAddProduct(activeGroup, searchQuery.trim());
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#0f5c4c] text-white text-xs font-bold whitespace-nowrap"
                    >
                      + नवीन अ‍ॅड करा
                    </button>
                  </div>
                ) : (
                  <>
                    {filteredProducts.slice(0, 80).map((p) => {
                      const k = kindOf(p);
                      const info =
                        k === 'box'
                          ? p.sqftPerBox > 0
                            ? `1 Box = ${p.sqftPerBox} Sq.Ft · ₹${fmt((p.rate / 100) * p.sqftPerBox)}/Box`
                            : 'Box Sq.Ft भरा'
                          : RATE_UNIT[k];
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectProduct(p)}
                          className="w-full text-left px-3.5 py-2.5 border-b border-slate-100 hover:bg-[#e6f4f1] flex items-center justify-between gap-3 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-[#182220] truncate">
                              {p.name}
                            </div>
                            <div className="text-xs text-[#64748b]">
                              {p.code ? `${p.code} · ` : ''}
                              {info}
                            </div>
                          </div>
                          {p.rate > 0 ? (
                            <span className="font-mono-num font-bold text-sm text-[#0f5c4c] whitespace-nowrap shrink-0">
                              ₹{fr(p.rate)}
                              {k === 'box' ? '/100' : ''}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-[#dc2626] whitespace-nowrap shrink-0">
                              रेट भरा
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {filteredProducts.length > 80 && (
                      <div className="p-2 text-center text-xs text-[#64748b]">
                        अजून {filteredProducts.length - 80} आहेत — शोध अरुंद करा
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Selected Product Rate & Conversion Panel */}
          {selectedProduct && (
            <div className="bg-[#e6f4f1] border border-[#b7dfd5] rounded-xl p-3.5 mb-3">
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div className="text-sm font-bold text-[#0f5c4c]">{selectedProduct.name}</div>
                {selectedProduct.code && (
                  <span className="text-xs font-mono-num text-[#0f5c4c]/80 shrink-0">
                    #{selectedProduct.code}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-[#2a4a42] mb-1">
                    {RATE_LABEL[currentKind]}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={rateAStr}
                    onChange={(e) => handleRateAChange(e.target.value)}
                    placeholder="रेट टाका"
                    className="w-full min-h-[42px] px-3 py-1.5 rounded-lg border border-[#a7d5c9] bg-white text-[15px] tabular-nums focus:outline-none focus:border-[#0f5c4c]"
                  />
                </div>
                {currentKind === 'box' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#2a4a42] mb-1">
                      रेट प्रति Sq.Ft (₹)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={rateBStr}
                      onChange={(e) => handleRateBChange(e.target.value)}
                      placeholder="Sq.Ft रेट"
                      className="w-full min-h-[42px] px-3 py-1.5 rounded-lg border border-[#a7d5c9] bg-white text-[15px] tabular-nums focus:outline-none focus:border-[#0f5c4c]"
                    />
                  </div>
                )}
              </div>

              {currentKind === 'box' && (
                <>
                  <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-[#2a4a42] mb-1">
                        रेट प्रति Box (₹)
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={rateBoxStr}
                        onChange={(e) => handleRateBoxChange(e.target.value)}
                        placeholder="Box रेट"
                        className="w-full min-h-[42px] px-3 py-1.5 rounded-lg border border-[#a7d5c9] bg-white text-[15px] tabular-nums focus:outline-none focus:border-[#0f5c4c]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#2a4a42] mb-1">
                        रेट प्रति Pic (₹)
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={ratePicStr}
                        onChange={(e) => handleRatePicChange(e.target.value)}
                        placeholder="Pic रेट"
                        className="w-full min-h-[42px] px-3 py-1.5 rounded-lg border border-[#a7d5c9] bg-white text-[15px] tabular-nums focus:outline-none focus:border-[#0f5c4c]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-[#2a4a42] mb-1">
                        1 Box मधील Sq.Ft
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={sqftBoxStr}
                        onChange={(e) => handleSqftBoxChange(e.target.value)}
                        placeholder="उदा. 16"
                        className="w-full min-h-[42px] px-3 py-1.5 rounded-lg border border-[#a7d5c9] bg-white text-[15px] tabular-nums focus:outline-none focus:border-[#0f5c4c]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#2a4a42] mb-1">
                        1 Box मधील Pic
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={picsBoxStr}
                        onChange={(e) => handlePicsBoxChange(e.target.value)}
                        placeholder="उदा. 6"
                        className="w-full min-h-[42px] px-3 py-1.5 rounded-lg border border-[#a7d5c9] bg-white text-[15px] tabular-nums focus:outline-none focus:border-[#0f5c4c]"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-[#b7dfd5]">
                {currentKind === 'box' ? (
                  <span className="text-sm font-bold text-[#0f5c4c] tabular-nums">
                    1 Box रेट: ₹{fmt(boxRateNow)}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-[#2a4a42]">
                    रेट लिस्टमध्ये कायमचा सेव्ह करा
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onUpdateProductMaster(
                      selectedProduct.id,
                      curRate,
                      currentKind === 'box' ? curSqftBox : undefined,
                      currentKind === 'box' ? curPics : undefined
                    );
                    onToast('रेट रेट-लिस्टमध्ये सेव्ह झाला');
                  }}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white border border-[#0f5c4c] text-[#0f5c4c] text-xs font-bold hover:bg-[#0f5c4c] hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  हा रेट लिस्टमध्ये सेव्ह करा
                </button>
              </div>
            </div>
          )}

          {/* Size Inputs (Box & SqFt groups) */}
          {(currentKind === 'box' || currentKind === 'sqft') && (
            <div className="mb-3">
              <label className="block text-xs font-semibold text-[#52605d] mb-1.5">
                माप टाकण्याची पद्धत (Size Mode)
              </label>
              <div className="grid grid-cols-2 bg-[#eef2f1] p-1 rounded-xl mb-2.5">
                <button
                  type="button"
                  onClick={() => handleSizeModeChange('lxw')}
                  className={`min-h-[40px] rounded-lg text-xs font-bold transition-colors ${
                    sizeMode === 'lxw'
                      ? 'bg-[#0f5c4c] text-white'
                      : 'text-[#52605d] hover:text-[#182220]'
                  }`}
                >
                  फूट × फूट (L × W)
                </button>
                <button
                  type="button"
                  onClick={() => handleSizeModeChange('direct')}
                  className={`min-h-[40px] rounded-lg text-xs font-bold transition-colors ${
                    sizeMode === 'direct'
                      ? 'bg-[#0f5c4c] text-white'
                      : 'text-[#52605d] hover:text-[#182220]'
                  }`}
                >
                  डायरेक्ट Sq. Ft.
                </button>
              </div>

              {sizeMode === 'lxw' ? (
                <>
                  <div className="mb-2.5">
                    <label className="block text-xs font-semibold text-[#52605d] mb-1">
                      माप कशात आहे? (Unit)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {UNIT_ORDER.map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => handleUnitChange(u)}
                          className={`min-h-[38px] px-3 py-1 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
                            sizeUnit === u
                              ? 'bg-[#0f5c4c] text-white border-[#0f5c4c]'
                              : 'bg-[#f4f6f5] text-[#334155] border-[#dce3e0] hover:bg-[#e6f4f1]'
                          }`}
                        >
                          {UNITS[u].n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#52605d] mb-1">
                        लांबी (Length - {UNITS[sizeUnit].n})
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={lenVal}
                        onChange={(e) => handleLenChange(e.target.value)}
                        placeholder="उदा. 12"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#cbd5d1] bg-white text-[15px] tabular-nums focus:outline-none focus:border-[#0f5c4c]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#52605d] mb-1">
                        रुंदी (Width - {UNITS[sizeUnit].n})
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={widVal}
                        onChange={(e) => handleWidChange(e.target.value)}
                        placeholder="उदा. 14"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#cbd5d1] bg-white text-[15px] tabular-nums focus:outline-none focus:border-[#0f5c4c]"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-[#52605d] mb-1">
                    एकूण क्षेत्रफळ (Total Sq. Ft.)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={directVal}
                    onChange={(e) => handleDirectChange(e.target.value)}
                    placeholder="उदा. 168"
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#cbd5d1] bg-white text-[15px] tabular-nums focus:outline-none focus:border-[#0f5c4c]"
                  />
                </div>
              )}
            </div>
          )}

          {/* Calculation Summary & Stepper */}
          <div className="bg-[#f8faf9] border border-dashed border-[#cbd5e1] rounded-xl p-3 mb-3.5">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded-lg border border-[#e2e8f0] p-2 text-center">
                <div className="text-[11px] font-medium text-[#64748b]">
                  {currentKind === 'pcs' ? 'रेट/नग' : 'क्षेत्रफळ'}
                </div>
                <div className="text-sm sm:text-base font-extrabold text-[#0f5c4c] mt-0.5 tabular-nums">
                  {currentKind === 'pcs' ? `₹${fr(curRate)}` : `${fr(area)} Sq.Ft`}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-[#e2e8f0] p-2 text-center">
                <div className="text-[11px] font-medium text-[#64748b]">
                  {currentKind === 'box'
                    ? 'बॉक्सेस'
                    : currentKind === 'sqft'
                      ? 'रेट/Sq.Ft'
                      : 'नग'}
                </div>
                <div className="text-sm sm:text-base font-extrabold text-[#0f5c4c] mt-0.5 tabular-nums">
                  {currentKind === 'box'
                    ? `${qty} Box`
                    : currentKind === 'sqft'
                      ? `₹${fr(curRate)}`
                      : String(qty)}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-[#e2e8f0] p-2 text-center">
                <div className="text-[11px] font-medium text-[#64748b]">रक्कम</div>
                <div className="text-sm sm:text-base font-extrabold text-[#0f5c4c] mt-0.5 tabular-nums">
                  ₹{fmt(lineAmount)}
                </div>
              </div>
            </div>

            {(currentKind === 'box' || currentKind === 'pcs') && (
              <div className="flex items-center justify-between gap-3 mt-3 pt-2.5 border-t border-[#e2e8f0]">
                <div>
                  <div className="text-xs sm:text-sm font-bold text-[#182220]">
                    {currentKind === 'pcs' ? 'नग (Quantity)' : 'लागणारे बॉक्सेस (Boxes)'}
                  </div>
                  <div className="text-[11px] text-[#64748b]">
                    {currentKind === 'box' && curSqftBox > 0 && qty > 0
                      ? `एकूण कव्हर: ${fr(qty * curSqftBox)} Sq.Ft`
                      : currentKind === 'pcs'
                        ? '+ / − दाबा किंवा संख्या टाका'
                        : 'वेस्टेज / जादा बॉक्ससाठी + दाबा'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="कमी करा"
                    onClick={() => setQty((q) => Math.max(0, q - 1))}
                    className="w-11 h-11 rounded-xl border border-[#0f5c4c] bg-white text-[#0f5c4c] flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={qty === 0 ? '' : qty}
                    placeholder="0"
                    onChange={(e) => setQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-16 h-11 text-center font-extrabold text-base text-[#182220] bg-white border border-[#cbd5d1] rounded-xl tabular-nums focus:outline-none focus:border-[#0f5c4c]"
                  />
                  <button
                    type="button"
                    aria-label="वाढवा"
                    onClick={() => setQty((q) => q + 1)}
                    className="w-11 h-11 rounded-xl border border-[#0f5c4c] bg-white text-[#0f5c4c] flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleAddOrUpdateItem}
            className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#0f5c4c] hover:bg-[#0b4a3d] text-white font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.99] transition-all"
          >
            {editingIndex !== null ? (
              <>
                <Check className="w-5 h-5" /> आयटम अपडेट करा
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" /> यादीत जोडा (Add Item)
              </>
            )}
          </button>
        </section>
      </div>

      {/* RIGHT WORKSPACE: Live Estimate Slip (screen) + Dedicated A4 Template (print) */}
      <div className="lg:col-span-5 lg:sticky lg:top-20 no-print">
        <section
          id="print-slip"
          className="bg-white rounded-2xl border border-[#dce3e0] p-4 sm:p-5"
        >
          <div className="flex items-center justify-between mb-3 no-print">
            <h2 className="text-[15px] font-bold text-[#182220]">३. Estimate फॉरमॅट (Bill Slip)</h2>
            <span className="text-xs font-bold text-[#0f5c4c] tabular-nums">
              {rooms.length} Items
            </span>
          </div>

          <div className="hidden print-only text-center mb-3">
            <div className="text-2xl font-extrabold">{shopName}</div>
            <div className="text-sm font-bold tracking-wider mt-0.5">ESTIMATE</div>
          </div>

          <div className="text-[13px] bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 mb-3 space-y-1">
            <div className="print:hidden">
              <span className="font-bold text-[#182220]">दुकान:</span> {shopName}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              <span>
                <span className="font-bold text-[#182220]">कस्टमर:</span>{' '}
                {custName.trim() || '---'}
                {custPhone.trim() ? ` (${custPhone.trim()})` : ''}
              </span>
              <span className="text-[#64748b]">·</span>
              <span className="tabular-nums">
                <span className="font-bold text-[#182220]">तारीख:</span> {fdate(slipTs)}
              </span>
            </div>
            <div>
              <span className="font-bold text-[#182220]">विक्रेता:</span>{' '}
              {salesman.trim() || '---'}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#f1f5f9] text-[#475569] text-[11px] text-left">
                  <th className="py-2 px-2 font-bold">रूम / साईज</th>
                  <th className="py-2 px-2 font-bold">वस्तू &amp; रेट</th>
                  <th className="py-2 px-2 font-bold text-right">Qty</th>
                  <th className="py-2 px-2 font-bold text-right">रक्कम</th>
                  <th className="py-2 px-1 no-print"></th>
                </tr>
              </thead>
              <tbody>
                {rooms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-[#64748b] py-8 text-sm">
                      अजून काहीही जोडलेले नाही.
                    </td>
                  </tr>
                ) : (
                  rooms.map((r, i) => (
                    <tr
                      key={`${r.name}-${i}`}
                      className={`border-b border-[#e2e8f0] align-top ${
                        editingIndex === i ? 'bg-[#e6f4f1]/60' : ''
                      }`}
                    >
                      <td className="py-2.5 px-2">
                        <div className="font-bold text-[#182220]">{r.room}</div>
                        {r.sizeText && (
                          <div className="text-[11px] text-[#64748b]">{r.sizeText}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="font-bold text-[#182220]">{r.name}</div>
                        <div className="text-[11px] text-[#64748b]">{r.rateText}</div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-[#182220] whitespace-nowrap tabular-nums">
                        {qtyText(r)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-[#182220] whitespace-nowrap tabular-nums">
                        ₹{fmt(r.amount)}
                      </td>
                      <td className="py-1.5 px-1 no-print whitespace-nowrap">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            aria-label="बदल करा"
                            onClick={() => handleEditRow(i)}
                            className="min-h-[36px] min-w-[32px] flex items-center justify-center rounded-lg text-[#0f5c4c] hover:bg-[#e6f4f1]"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="काढा"
                            onClick={() => {
                              const next = rooms.filter((_, idx) => idx !== i);
                              onRoomsChange(next);
                              if (editingIndex === i) resetCalculatorInputs();
                            }}
                            className="min-h-[36px] min-w-[32px] flex items-center justify-center rounded-lg text-[#dc2626] hover:bg-[#fee2e2]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-[#e6f4f1] text-[#0f5c4c] rounded-xl px-3.5 py-3 mt-3 flex flex-wrap items-center justify-between gap-2 font-extrabold tabular-nums">
            <span className="text-sm">
              {totalBoxes > 0 ? `एकूण Boxes: ${totalBoxes}` : 'एकूण रक्कम'}
            </span>
            <span className="text-base sm:text-lg">
              {totalBoxes > 0 ? `एकूण रक्कम: ₹${fmt(totalAmount)}` : `₹${fmt(totalAmount)}`}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 no-print">
            <button
              type="button"
              onClick={onSaveBill}
              className="min-h-[44px] px-3 py-2.5 rounded-xl bg-[#0f5c4c] hover:bg-[#0b4a3d] text-white text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Save className="w-4 h-4" /> Estimate सेव्ह करा
            </button>
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="min-h-[44px] px-3 py-2.5 rounded-xl border border-[#0f5c4c] bg-white hover:bg-[#e6f4f1] text-[#0f5c4c] text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Copy className="w-4 h-4" /> WhatsApp कॉपी
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2 no-print">
            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[44px] px-3 py-2 rounded-xl border border-[#cbd5d1] bg-white hover:bg-slate-50 text-[#182220] text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Printer className="w-4 h-4" /> Print / PDF
            </button>
            <button
              type="button"
              disabled={renderingImg}
              onClick={handleShareBillImage}
              className="min-h-[44px] px-3 py-2 rounded-xl border border-[#cbd5d1] bg-white hover:bg-slate-50 text-[#182220] text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-60"
            >
              <ImageIcon className="w-4 h-4" /> {renderingImg ? 'तयार होत आहे...' : 'Bill फोटो / शेअर'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleClearClick}
            className="w-full min-h-[42px] mt-2 px-3 py-2 rounded-xl bg-[#fee2e2] hover:bg-[#fecaca] text-[#dc2626] text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 no-print"
          >
            <RotateCcw className="w-4 h-4" /> नवीन कस्टमर (Clear)
          </button>

          <p className="text-[11px] text-[#64748b] mt-2 no-print">
            "Print / PDF" मधून A4 टेम्प्लेट पहा, PDF सेव्ह करा किंवा "Bill फोटो / शेअर" ने फोटो पाठवा.
          </p>
        </section>
      </div>

      {/* Dedicated A4 Print / PDF Template */}
      <div className="hidden print-only col-span-full">
        <PrintEstimateTemplate
          shopName={shopName}
          custName={custName}
          custPhone={custPhone}
          salesman={salesman}
          slipTs={slipTs}
          billId={currentBillId}
          rooms={rooms}
        />
      </div>
    </div>
  );
}
