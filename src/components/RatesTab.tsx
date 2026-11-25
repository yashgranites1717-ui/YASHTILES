import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Pencil,
  Plus,
  Search,
  Share2,
  Tags,
  Trash2,
  Upload,
} from 'lucide-react';
import { GROUPS, GROUP_ORDER, RATE_LABEL, RATE_UNIT } from '../data/seed';
import type { DialogState, GroupId, Product } from '../types';
import {
  buildRatesShareMessage,
  copyToClipboard,
  fmt,
  kindOf,
  parseRatesImportCode,
} from '../utils/storage';

interface RatesTabProps {
  shopName: string;
  products: Product[];
  prefillDraft?: { group: GroupId; name: string } | null;
  onClearPrefill?: () => void;
  onSaveProduct: (product: Omit<Product, 'id'> & { id?: number }) => boolean;
  onQuickUpdateProduct: (id: number, patch: Partial<Product>) => void;
  onDeleteProduct: (id: number) => void;
  onBulkUpdateRates: (ids: number[], rate: number) => void;
  onReplaceAllProducts: (list: Product[], shop?: string) => void;
  onToast: (msg: string) => void;
  onOpenDialog: (dialog: DialogState) => void;
}

type StatusFilter = 'all' | 'missing_rate' | 'check_sqft';

export function RatesTab({
  shopName,
  products,
  prefillDraft,
  onClearPrefill,
  onSaveProduct,
  onQuickUpdateProduct,
  onDeleteProduct,
  onBulkUpdateRates,
  onReplaceAllProducts,
  onToast,
  onOpenDialog,
}: RatesTabProps) {
  const [formGroup, setFormGroup] = useState<GroupId>('tiles');
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formSqft, setFormSqft] = useState('');
  const [formPics, setFormPics] = useState('');
  const [formRate, setFormRate] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const [masterGroup, setMasterGroup] = useState<'all' | GroupId>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [showLimit, setShowLimit] = useState(60);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (prefillDraft) {
      setFormGroup(prefillDraft.group);
      setFormName(prefillDraft.name);
      setEditingId(null);
      onClearPrefill?.();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [prefillDraft, onClearPrefill]);

  const formKind = GROUPS[formGroup].kind;

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter((p) => {
      if (masterGroup !== 'all' && p.group !== masterGroup) return false;
      if (statusFilter === 'missing_rate' && p.rate > 0) return false;
      if (statusFilter === 'check_sqft' && !(kindOf(p) === 'box' && (!(p.sqftPerBox > 0) || p.chk))) {
        return false;
      }
      if (q && !p.name.toLowerCase().includes(q) && !(p.code || '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [products, masterGroup, statusFilter, search]);

  const missingRateCount = useMemo(() => products.filter((p) => !(p.rate > 0)).length, [products]);
  const checkSqftCount = useMemo(
    () => products.filter((p) => kindOf(p) === 'box' && (!(p.sqftPerBox > 0) || p.chk)).length,
    [products]
  );

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    const sqft = parseFloat(formSqft) || 0;
    const pics = parseInt(formPics, 10) || 0;
    const rate = parseFloat(formRate) || 0;

    if (!name || !(rate > 0) || (formKind === 'box' && !(sqft > 0))) {
      onToast('कृपया सर्व माहिती अचूक भरा');
      return;
    }

    const updatedExisting = onSaveProduct({
      id: editingId ?? undefined,
      code: formCode.trim(),
      name,
      group: formGroup,
      sqftPerBox: formKind === 'box' ? sqft : 0,
      pics: formKind === 'box' ? pics : 0,
      rate,
      chk: false,
    });

    setFormCode('');
    setFormName('');
    setFormSqft('');
    setFormPics('');
    setFormRate('');
    setEditingId(null);
    setMasterGroup(formGroup);
    setSearch('');
    onToast(updatedExisting ? 'प्रोडक्ट रेट अपडेट झाला' : 'नवीन प्रोडक्ट सेव्ह झाले');
  };

  const handleEditClick = (p: Product) => {
    setEditingId(p.id);
    setFormGroup(p.group);
    setFormCode(p.code || '');
    setFormName(p.name);
    setFormSqft(p.sqftPerBox ? String(p.sqftPerBox) : '');
    setFormPics(p.pics ? String(p.pics) : '');
    setFormRate(p.rate ? String(p.rate) : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onToast('वर फॉर्ममध्ये बदल करून सेव्ह करा');
  };

  const handleDeleteClick = (p: Product) => {
    onOpenDialog({
      type: 'confirm',
      title: 'प्रोडक्ट काढायचा का?',
      message: `${p.name} हा प्रोडक्ट रेट लिस्टमधून काढला जाईल.`,
      confirmLabel: 'डिलीट करा',
      danger: true,
      onConfirm: () => onDeleteProduct(p.id),
    });
  };

  const handleBulkRateClick = () => {
    if (!filteredProducts.length) {
      onToast('लिस्ट रिकामी आहे');
      return;
    }
    const targetIds = filteredProducts.map((p) => p.id);
    onOpenDialog({
      type: 'prompt',
      title: 'एकच रेट लावा (Bulk Rate)',
      message: `खाली दिसणाऱ्या ${targetIds.length} प्रोडक्ट्सना एकच रेट (₹) लावायचा आहे. रेट टाका:`,
      placeholder: 'उदा. 4200',
      inputType: 'number',
      initialValue: '',
      confirmLabel: `${targetIds.length} ला लागू करा`,
      onConfirm: (val) => {
        const r = parseFloat(val);
        if (!(r > 0)) {
          onToast('योग्य रेट टाका');
          return;
        }
        onBulkUpdateRates(targetIds, r);
        onToast(`${targetIds.length} प्रोडक्ट्सचा रेट ₹${r} झाला`);
      },
    });
  };

  const handleExportRates = async (mode: 'share' | 'copy') => {
    try {
      const msg = await buildRatesShareMessage(shopName, products);
      if (mode === 'share' && typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ text: msg });
          return;
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') return;
        }
      }
      const ok = await copyToClipboard(msg);
      onToast(ok ? 'कोड कॉपी झाला! WhatsApp वर Paste करा' : 'कॉपी झाले नाही');
    } catch {
      onToast('रेट लिस्ट कोड तयार करता आला नाही');
    }
  };

  const handleImportRates = async () => {
    if (!importText.trim()) {
      onToast('कृपया मेसेज पेस्ट करा');
      return;
    }
    setImporting(true);
    try {
      const { shop, products: imported } = await parseRatesImportCode(importText);
      onOpenDialog({
        type: 'confirm',
        title: 'नवीन रेट लिस्ट लोड करायची का?',
        message: `${imported.length} प्रोडक्ट्सची नवीन लिस्ट लोड होईल.\nसध्याची रेट लिस्ट बदलली जाईल.`,
        confirmLabel: 'होय, अपडेट करा',
        onConfirm: () => {
          onReplaceAllProducts(imported, shop);
          setImportText('');
          setImportOpen(false);
          onToast(`${imported.length} प्रोडक्ट्सचे नवीन रेट्स अपडेट झाले`);
        },
      });
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'कोड वाचता आला नाही');
    } finally {
      setImporting(false);
    }
  };

  const displayed = filteredProducts.slice(0, showLimit);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT COLUMN: WhatsApp Sync + Add/Edit Product */}
      <div className="lg:col-span-5 space-y-4">
        <section className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-2xl p-4 sm:p-5">
          <h2 className="text-[15px] font-bold text-[#065f46] mb-1.5">
            सेल्समनला रेट लिस्ट पाठवा (Offline Sync)
          </h2>
          <p className="text-xs text-[#047857] leading-relaxed mb-3">
            रेट बदलल्यावर "WhatsApp वर पाठवा" दाबून सेल्समनच्या ग्रुपमध्ये पाठवा. सेल्समन तो मेसेज कॉपी करून खाली "नवीन लिस्ट लोड करा" मध्ये पेस्ट करतात.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleExportRates('share')}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-[#0f5c4c] hover:bg-[#0b4a3d] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Share2 className="w-4 h-4" /> WhatsApp वर पाठवा
            </button>
            <button
              type="button"
              onClick={() => handleExportRates('copy')}
              className="min-h-[44px] px-3 py-2 rounded-xl border border-[#0f5c4c] bg-white hover:bg-[#e6f4f1] text-[#0f5c4c] text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Copy className="w-4 h-4" /> कोड कॉपी
            </button>
          </div>
          <button
            type="button"
            onClick={() => setImportOpen((v) => !v)}
            className="w-full min-h-[42px] mt-2 px-3 py-2 rounded-xl border border-[#0f5c4c]/40 bg-white text-[#065f46] text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5"
          >
            <Upload className="w-4 h-4" />
            नवीन लिस्ट लोड करा (सेल्समनसाठी)
            {importOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {importOpen && (
            <div className="mt-3 pt-3 border-t border-[#a7f3d0]">
              <label className="block text-xs font-semibold text-[#065f46] mb-1">
                WhatsApp वरून कॉपी केलेला मेसेज येथे पेस्ट करा:
              </label>
              <textarea
                rows={4}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="येथे पेस्ट करा..."
                className="w-full p-3 rounded-xl border border-[#a7f3d0] bg-white text-sm text-[#182220] focus:outline-none focus:border-[#0f5c4c]"
              />
              <button
                type="button"
                disabled={importing}
                onClick={handleImportRates}
                className="w-full min-h-[44px] mt-2 px-4 py-2 rounded-xl bg-[#0f5c4c] text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <Check className="w-4 h-4" /> {importing ? 'तपासत आहे...' : 'लिस्ट अपडेट करा'}
              </button>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-[#dce3e0] p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-[#182220]">
              {editingId ? 'प्रोडक्ट अपडेट करा' : 'नवीन प्रोडक्ट अ‍ॅड / अपडेट करा'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setFormCode('');
                  setFormName('');
                  setFormSqft('');
                  setFormPics('');
                  setFormRate('');
                }}
                className="text-xs font-semibold text-[#dc2626] hover:underline"
              >
                रद्द करा
              </button>
            )}
          </div>

          <form onSubmit={handleSaveForm} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#52605d] mb-1">
                  ग्रुप (Group)
                </label>
                <select
                  value={formGroup}
                  onChange={(e) => setFormGroup(e.target.value as GroupId)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#cbd5d1] bg-white text-[15px] text-[#182220] focus:outline-none focus:border-[#0f5c4c]"
                >
                  {GROUP_ORDER.map((g) => (
                    <option key={g} value={g}>
                      {GROUPS[g].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#52605d] mb-1">
                  कोड (ऐच्छिक)
                </label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="उदा. 10032504"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#cbd5d1] bg-white text-[15px] font-mono-num focus:outline-none focus:border-[#0f5c4c]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#52605d] mb-1">
                नाव / कोड (Name)
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="उदा. S_50152 Marble 2x4"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#cbd5d1] bg-white text-[15px] text-[#182220] focus:outline-none focus:border-[#0f5c4c]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {formKind === 'box' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[#52605d] mb-1">
                      1 Box मधील Sq. Ft.
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={formSqft}
                      onChange={(e) => setFormSqft(e.target.value)}
                      placeholder="उदा. 16"
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#cbd5d1] bg-white text-[15px] tabular-nums focus:outline-none focus:border-[#0f5c4c]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#52605d] mb-1">
                      1 Box मधील Pic (ऐच्छिक)
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={formPics}
                      onChange={(e) => setFormPics(e.target.value)}
                      placeholder="उदा. 2"
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#cbd5d1] bg-white text-[15px] tabular-nums focus:outline-none focus:border-[#0f5c4c]"
                    />
                  </div>
                </>
              )}
              <div className={formKind === 'box' ? 'col-span-2' : 'col-span-2'}>
                <label className="block text-xs font-semibold text-[#52605d] mb-1">
                  {RATE_LABEL[formKind]}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={formRate}
                  onChange={(e) => setFormRate(e.target.value)}
                  placeholder="उदा. 4000"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#cbd5d1] bg-white text-[15px] tabular-nums focus:outline-none focus:border-[#0f5c4c]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#0f5c4c] hover:bg-[#0b4a3d] text-white font-bold text-sm flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> प्रोडक्ट सेव्ह करा
            </button>
            <p className="text-[11px] text-[#64748b]">
              तेच नाव पुन्हा टाकल्यास जुना रेट अपडेट होईल.
            </p>
          </form>
        </section>
      </div>

      {/* RIGHT COLUMN: Master Rate List */}
      <div className="lg:col-span-7">
        <section className="bg-white rounded-2xl border border-[#dce3e0] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-[15px] font-bold text-[#182220]">
              सध्याची रेट लिस्ट ({products.length})
            </h2>
            <span className="text-xs text-[#64748b] tabular-nums">
              दिसत आहेत: {filteredProducts.length}
            </span>
          </div>

          {/* Group Filter */}
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            <button
              type="button"
              onClick={() => {
                setMasterGroup('all');
                setShowLimit(60);
              }}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
                masterGroup === 'all'
                  ? 'bg-[#0f5c4c] text-white border-[#0f5c4c]'
                  : 'bg-[#f4f6f5] text-[#334155] border-[#dce3e0] hover:bg-[#e6f4f1]'
              }`}
            >
              सर्व (All)
            </button>
            {GROUP_ORDER.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setMasterGroup(g);
                  setShowLimit(60);
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
                  masterGroup === g
                    ? 'bg-[#0f5c4c] text-white border-[#0f5c4c]'
                    : 'bg-[#f4f6f5] text-[#334155] border-[#dce3e0] hover:bg-[#e6f4f1]'
                }`}
              >
                {GROUPS[g].short}
              </button>
            ))}
          </div>

          {/* Status Quick Filters */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-[#182220] text-white'
                  : 'bg-slate-100 text-[#475569] hover:bg-slate-200'
              }`}
            >
              सर्व स्थिती
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('missing_rate')}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                statusFilter === 'missing_rate'
                  ? 'bg-[#dc2626] text-white'
                  : 'bg-[#fee2e2]/70 text-[#b91c1c] hover:bg-[#fee2e2]'
              }`}
            >
              रेट बाकी ({missingRateCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('check_sqft')}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                statusFilter === 'check_sqft'
                  ? 'bg-[#b45309] text-white'
                  : 'bg-[#fef3c7]/80 text-[#92400e] hover:bg-[#fef3c7]'
              }`}
            >
              Sq.Ft तपासा ({checkSqftCount})
            </button>
          </div>

          {/* Search & Bulk Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-3">
            <div className="sm:col-span-7 relative flex items-center">
              <Search className="w-4 h-4 text-[#64748b] absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowLimit(60);
                }}
                placeholder="लिस्टमधून शोधा (नाव / कोड)..."
                className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-[#cbd5d1] bg-white text-[15px] text-[#182220] focus:outline-none focus:border-[#0f5c4c]"
              />
            </div>
            <button
              type="button"
              onClick={handleBulkRateClick}
              className="sm:col-span-5 min-h-[44px] px-3 py-2 rounded-xl border border-[#0f5c4c] bg-white hover:bg-[#e6f4f1] text-[#0f5c4c] text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Tags className="w-4 h-4" /> सर्वांना एकच रेट लावा
            </button>
          </div>

          <p className="text-[11px] text-[#64748b] mb-2">
            प्रत्येक ओळीतील बॉक्समध्ये थेट रेट किंवा Box Sq.Ft टाकून बदलता येतात.
          </p>

          {displayed.length === 0 ? (
            <div className="text-center py-10 text-sm text-[#64748b] border border-dashed border-[#dce3e0] rounded-xl">
              काहीही सापडले नाही.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {displayed.map((p) => {
                const k = kindOf(p);
                const boxPrice =
                  k === 'box' && p.rate > 0 && p.sqftPerBox > 0
                    ? fmt((p.rate / 100) * p.sqftPerBox)
                    : null;

                return (
                  <div
                    key={p.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-[#182220] break-words">
                        {p.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#64748b] mt-0.5 tabular-nums">
                        <span>{GROUPS[p.group].short}</span>
                        {p.code && <span>· #{p.code}</span>}
                        {k === 'box' && (
                          <>
                            <span>·</span>
                            <label className="inline-flex items-center gap-1">
                              <span>1 Box =</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                value={p.sqftPerBox || ''}
                                placeholder="Sq.Ft"
                                onChange={(e) =>
                                  onQuickUpdateProduct(p.id, {
                                    sqftPerBox: Math.max(0, parseFloat(e.target.value) || 0),
                                    chk: false,
                                  })
                                }
                                className="w-16 px-1.5 py-0.5 rounded border border-[#cbd5d1] bg-white text-xs font-bold text-[#182220] tabular-nums focus:outline-none focus:border-[#0f5c4c]"
                              />
                              <span>Sq.Ft</span>
                            </label>
                            {boxPrice && (
                              <span className="font-semibold text-[#0f5c4c]">
                                · ₹{boxPrice}/Box
                              </span>
                            )}
                          </>
                        )}
                        {k === 'box' && !(p.sqftPerBox > 0) && (
                          <span className="text-[#dc2626] font-bold">· Box Sq.Ft भरा</span>
                        )}
                        {k === 'box' && p.sqftPerBox > 0 && p.chk && (
                          <span className="text-[#b45309] font-bold">· Sq.Ft तपासा</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={p.rate || ''}
                        placeholder={RATE_UNIT[k]}
                        onChange={(e) =>
                          onQuickUpdateProduct(p.id, {
                            rate: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        className="w-24 min-h-[40px] px-2.5 py-1.5 rounded-xl border border-[#cbd5d1] bg-white text-sm font-bold text-right tabular-nums text-[#182220] focus:outline-none focus:border-[#0f5c4c]"
                      />
                      <button
                        type="button"
                        aria-label="एडिट करा"
                        onClick={() => handleEditClick(p)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-[#e6f4f1] text-[#0f5c4c] hover:bg-[#d1ece5]"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="डिलीट करा"
                        onClick={() => handleDeleteClick(p)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-[#fee2e2] text-[#dc2626] hover:bg-[#fecaca]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredProducts.length > displayed.length && (
            <button
              type="button"
              onClick={() => setShowLimit((n) => n + 100)}
              className="w-full min-h-[44px] mt-3 px-4 py-2 rounded-xl border border-[#cbd5d1] bg-[#f8faf9] text-sm font-bold text-[#0f5c4c] hover:bg-[#e6f4f1]"
            >
              अजून दाखवा ({filteredProducts.length - displayed.length} बाकी)
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
