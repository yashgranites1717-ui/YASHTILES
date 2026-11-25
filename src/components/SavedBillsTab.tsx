import { useMemo, useRef, useState } from 'react';
import { Copy, Download, FileSpreadsheet, FolderOpen, Search, Trash2, Upload } from 'lucide-react';
import { GROUPS } from '../data/seed';
import type { DialogState, Product, SavedBill } from '../types';
import {
  copyToClipboard,
  dkey,
  downloadBlob,
  fdate,
  fmt,
  fr,
  ftime,
  normalizeBill,
  qtyText,
} from '../utils/storage';

interface SavedBillsTabProps {
  shopName: string;
  products: Product[];
  savedBills: SavedBill[];
  hasUnsavedRooms: boolean;
  currentBillId: number | null;
  onLoadBill: (bill: SavedBill) => void;
  onDeleteBill: (id: number) => void;
  onRestoreBackup: (data: { shop?: string; products: Product[]; bills: SavedBill[] }) => void;
  onToast: (msg: string) => void;
  onOpenDialog: (dialog: DialogState) => void;
}

function csvCell(v: unknown): string {
  const s = String(v == null ? '' : v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function SavedBillsTab({
  shopName,
  products,
  savedBills,
  hasUnsavedRooms,
  currentBillId,
  onLoadBill,
  onDeleteBill,
  onRestoreBackup,
  onToast,
  onOpenDialog,
}: SavedBillsTabProps) {
  const todayKey = dkey(Date.now());
  const [filterDate, setFilterDate] = useState(todayKey);
  const [search, setSearch] = useState('');
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const visibleBills = useMemo(() => {
    const q = search.toLowerCase().trim();
    return savedBills.filter(
      (b) =>
        (!filterDate || dkey(b.ts) === filterDate) &&
        (!q ||
          (b.custName || '').toLowerCase().includes(q) ||
          (b.custPhone || '').includes(q) ||
          (b.salesman || '').toLowerCase().includes(q))
    );
  }, [savedBills, filterDate, search]);

  const totalSum = useMemo(
    () => visibleBills.reduce((s, b) => s + b.totalAmount, 0),
    [visibleBills]
  );

  const handleExportCSV = () => {
    if (!visibleBills.length) {
      onToast('एक्स्पोर्ट करण्यासाठी Estimate नाहीत');
      return;
    }
    const rows: unknown[][] = [
      [
        'Date',
        'Time',
        'Salesman',
        'Customer',
        'Mobile',
        'Room',
        'Group',
        'Item',
        'Size',
        'Rate',
        'Qty',
        'Unit',
        'Amount',
        'Bill Total',
      ],
    ];
    visibleBills
      .slice()
      .reverse()
      .forEach((b) =>
        b.rooms.forEach((r, i) =>
          rows.push([
            fdate(b.ts),
            ftime(b.ts),
            b.salesman,
            b.custName,
            b.custPhone,
            r.room,
            (GROUPS[r.group] || GROUPS.tiles).short,
            r.name,
            r.sizeText,
            r.rateText,
            r.kind === 'sqft' ? fr(r.qty) : r.qty,
            r.unit,
            r.amount,
            i === 0 ? b.totalAmount : '',
          ])
        )
      );
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
    const label = filterDate || 'all';
    downloadBlob(`Estimates_${label}.csv`, csv, 'text/csv;charset=utf-8', true);
    onToast('Excel (CSV) फाईल डाउनलोड झाली');
  };

  const handleCopyDaySummary = async () => {
    if (!visibleBills.length) {
      onToast('Estimate नाहीत');
      return;
    }
    let text = `*${shopName} - Estimate रिपोर्ट*\nतारीख: ${filterDate ? fdate(visibleBills[0].ts) : 'सर्व'}\nएकूण Estimates: ${visibleBills.length}\nएकूण रक्कम: ₹${fmt(totalSum)}\n------------------\n`;
    visibleBills
      .slice()
      .reverse()
      .forEach((b, i) => {
        text += `${i + 1}. ${b.custName}${b.custPhone ? ` (${b.custPhone})` : ''} – ₹${fmt(b.totalAmount)}${b.salesman ? ` – ${b.salesman}` : ''}\n`;
      });
    const ok = await copyToClipboard(text);
    onToast(ok ? 'सारांश कॉपी झाला' : 'कॉपी झाले नाही');
  };

  const handleCopySingleBill = async (b: SavedBill) => {
    let text = `*${shopName} - ESTIMATE*\nकस्टमर: *${b.custName}*${b.custPhone ? ` (${b.custPhone})` : ''}\nतारीख: ${fdate(b.ts)}\n------------------\n`;
    b.rooms.forEach((r, i) => {
      text += `${i + 1}. *${r.room}*${r.sizeText ? ` (${r.sizeText})` : ''}\n   ${r.name}\n   ${qtyText(r)} × ₹${fmt(r.unitRate)} = *₹${fmt(r.amount)}*\n\n`;
    });
    text += `------------------\n`;
    if (b.totalBoxes > 0) text += `*एकूण Boxes:* ${b.totalBoxes}\n`;
    text += `*एकूण रक्कम:* ₹${fmt(b.totalAmount)}`;
    const ok = await copyToClipboard(text);
    onToast(ok ? 'WhatsApp बिल कॉपी झाले' : 'कॉपी झाले नाही');
  };

  const handleLoadClick = (b: SavedBill) => {
    if (hasUnsavedRooms && currentBillId !== b.id) {
      onOpenDialog({
        type: 'confirm',
        title: 'सेव्ह केलेले Estimate उघडायचे का?',
        message: 'सध्याची न सेव्ह केलेली यादी बदलली जाईल.',
        confirmLabel: 'होय, उघडा',
        onConfirm: () => onLoadBill(b),
      });
    } else {
      onLoadBill(b);
    }
  };

  const handleDeleteClick = (b: SavedBill) => {
    onOpenDialog({
      type: 'confirm',
      title: 'Estimate डिलीट करायचे का?',
      message: `${b.custName} (₹${fmt(b.totalAmount)}) हा रेकॉर्ड कायमचा डिलीट होईल.`,
      confirmLabel: 'डिलीट करा',
      danger: true,
      onConfirm: () => onDeleteBill(b.id),
    });
  };

  const handleBackupAll = () => {
    const data = {
      app: 'ytg',
      v: 2,
      ts: Date.now(),
      shop: shopName,
      products,
      bills: savedBills,
    };
    downloadBlob(`YTG_Backup_${dkey(Date.now())}.json`, JSON.stringify(data), 'application/json', false);
    onToast('बॅकअप फाईल डाउनलोड झाली');
  };

  const handleRestoreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '')) as {
          app?: string;
          shop?: string;
          products?: Product[];
          bills?: Array<Partial<SavedBill> & Record<string, unknown>>;
        };
        if (parsed.app !== 'ytg' || !Array.isArray(parsed.products) || !Array.isArray(parsed.bills)) {
          throw new Error('Invalid backup');
        }
        const restoredBills = parsed.bills.map(normalizeBill);
        const restoredProducts = parsed.products;
        onOpenDialog({
          type: 'confirm',
          title: 'बॅकअप रिस्टोअर करायचा का?',
          message: `बॅकअपमध्ये ${restoredProducts.length} प्रोडक्ट आणि ${restoredBills.length} Estimates आहेत.\nसध्याचा डेटा बदलला जाईल.`,
          confirmLabel: 'होय, रिस्टोअर करा',
          onConfirm: () =>
            onRestoreBackup({
              shop: parsed.shop,
              products: restoredProducts,
              bills: restoredBills,
            }),
        });
      } catch {
        onToast('ही बॅकअप फाईल योग्य नाही');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-8 space-y-4">
        <section className="bg-white rounded-2xl border border-[#dce3e0] p-4 sm:p-5">
          <h2 className="text-[15px] font-bold text-[#182220] mb-3">
            सेव्ह केलेले Estimates (Saved Bills)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-[#52605d] mb-1">तारीख (Date)</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#cbd5d1] bg-white text-[15px] text-[#182220] focus:outline-none focus:border-[#0f5c4c]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#52605d] mb-1">कस्टमर शोधा</label>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-[#64748b] absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="नाव / मोबाईल / सेल्समन"
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-[#cbd5d1] bg-white text-[15px] text-[#182220] focus:outline-none focus:border-[#0f5c4c]"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              onClick={() => setFilterDate(dkey(Date.now()))}
              className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
                filterDate === dkey(Date.now())
                  ? 'bg-[#0f5c4c] text-white border-[#0f5c4c]'
                  : 'bg-[#f4f6f5] text-[#334155] border-[#dce3e0] hover:bg-[#e6f4f1]'
              }`}
            >
              आज ({fdate(Date.now())})
            </button>
            <button
              type="button"
              onClick={() => setFilterDate('')}
              className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
                filterDate === ''
                  ? 'bg-[#0f5c4c] text-white border-[#0f5c4c]'
                  : 'bg-[#f4f6f5] text-[#334155] border-[#dce3e0] hover:bg-[#e6f4f1]'
              }`}
            >
              सर्व ({savedBills.length})
            </button>
          </div>

          <div className="bg-[#e6f4f1] text-[#0f5c4c] rounded-xl px-4 py-3 mb-3 flex items-center justify-between font-extrabold tabular-nums">
            <span className="text-sm">{visibleBills.length} Estimates</span>
            <span className="text-base">एकूण: ₹{fmt(totalSum)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              type="button"
              onClick={handleExportCSV}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-[#0f5c4c] hover:bg-[#0b4a3d] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel (CSV) फाईल
            </button>
            <button
              type="button"
              onClick={handleCopyDaySummary}
              className="min-h-[44px] px-3 py-2 rounded-xl border border-[#0f5c4c] bg-white hover:bg-[#e6f4f1] text-[#0f5c4c] text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Copy className="w-4 h-4" /> सारांश कॉपी
            </button>
          </div>

          {visibleBills.length === 0 ? (
            <div className="text-center py-10 text-sm text-[#64748b] border border-dashed border-[#dce3e0] rounded-xl">
              या तारखेला किंवा शोधात कोणतेही Estimate नाही.
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleBills.map((b) => (
                <div
                  key={b.id}
                  className="border border-[#dce3e0] rounded-xl p-3.5 hover:border-[#b7dfd5] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-[15px] text-[#182220] truncate">
                        {b.custName}
                        {b.custPhone && (
                          <span className="font-normal text-xs text-[#64748b] ml-2 tabular-nums">
                            {b.custPhone}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#64748b] mt-1 tabular-nums">
                        {fdate(b.ts)} {ftime(b.ts)} · {b.rooms.length} Items
                        {b.totalBoxes > 0 ? ` · ${b.totalBoxes} Boxes` : ''}
                        {b.salesman ? ` · ${b.salesman}` : ''}
                      </div>
                    </div>
                    <div className="font-mono-num font-extrabold text-base text-[#0f5c4c] whitespace-nowrap shrink-0">
                      ₹{fmt(b.totalAmount)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => handleLoadClick(b)}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-[#0f5c4c] text-[#0f5c4c] text-xs font-bold hover:bg-[#e6f4f1] flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <FolderOpen className="w-3.5 h-3.5" /> उघडा (Load)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopySingleBill(b)}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-[#cbd5d1] text-[#182220] text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Copy className="w-3.5 h-3.5" /> कॉपी
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(b)}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#fee2e2] text-[#dc2626] text-xs font-bold hover:bg-[#fecaca] flex items-center gap-1.5 whitespace-nowrap ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> डिलीट
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Backup Card */}
      <div className="lg:col-span-4">
        <section className="bg-white rounded-2xl border border-[#dce3e0] p-4 sm:p-5">
          <h2 className="text-[15px] font-bold text-[#182220] mb-1.5">बॅकअप आणि रिस्टोअर (Backup)</h2>
          <p className="text-xs text-[#64748b] leading-relaxed mb-4">
            सर्व रेट लिस्ट ({products.length} प्रोडक्ट) आणि सर्व Estimates ({savedBills.length} Bills) एका JSON फाईलमध्ये सुरक्षित ठेवा.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
            <button
              type="button"
              onClick={handleBackupAll}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0f5c4c] hover:bg-[#0b4a3d] text-white text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Download className="w-4 h-4" /> बॅकअप घ्या (Download)
            </button>
            <button
              type="button"
              onClick={() => restoreInputRef.current?.click()}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#0f5c4c] bg-white hover:bg-[#e6f4f1] text-[#0f5c4c] text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Upload className="w-4 h-4" /> रिस्टोअर करा (Restore)
            </button>
          </div>
          <input
            ref={restoreInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleRestoreFileChange}
          />
        </section>
      </div>
    </div>
  );
}
