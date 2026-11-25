import { useEffect, useState } from 'react';
import { Download, Printer, Share2, X } from 'lucide-react';
import type { DialogState, EstimateItem } from '../types';
import { renderBillToPngBlob } from '../utils/storage';
import { PrintEstimateTemplate } from './PrintEstimateTemplate';

interface AppDialogProps {
  dialog: DialogState;
  printData?: {
    shopName: string;
    custName: string;
    custPhone: string;
    salesman: string;
    slipTs: number;
    billId: number | null;
    rooms: EstimateItem[];
  };
  onClose: () => void;
  onToast: (msg: string) => void;
}

export function AppDialog({ dialog, printData, onClose, onToast }: AppDialogProps) {
  const [promptVal, setPromptVal] = useState('');
  const [downloadingPng, setDownloadingPng] = useState(false);

  useEffect(() => {
    if (dialog.type === 'prompt') {
      setPromptVal(dialog.initialValue);
    }
  }, [dialog]);

  useEffect(() => {
    if (dialog.type === 'none') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog.type, onClose]);

  if (dialog.type === 'none') return null;

  if (dialog.type === 'printPreview') {
    if (!printData) return null;
    const handlePngDownload = async () => {
      setDownloadingPng(true);
      try {
        const { blob, fileName } = await renderBillToPngBlob({
          shopName: printData.shopName,
          custName: printData.custName,
          custPhone: printData.custPhone,
          salesman: printData.salesman,
          slipTs: printData.slipTs,
          billId: printData.billId,
          items: printData.rooms,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(url);
          a.remove();
        }, 1200);
        onToast('Bill फोटो डाउनलोड झाला');
      } catch {
        onToast('फोटो तयार करता आला नाही');
      } finally {
        setDownloadingPng(false);
      }
    };

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-2 sm:p-4 no-print"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl border border-[#dce3e0] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#dce3e0] bg-white">
            <div>
              <h3 className="text-base font-bold text-[#182220]">A4 Print / PDF प्रीव्ह्यू</h3>
              <p className="text-xs text-[#64748b]">
                Print दाबून "Save as PDF" किंवा प्रिंटर निवडा
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="बंद करा"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#64748b] hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3 sm:p-6 overflow-y-auto bg-[#e2e8f0]/70 flex-1">
            <div className="shadow-md">
              <PrintEstimateTemplate
                shopName={printData.shopName}
                custName={printData.custName}
                custPhone={printData.custPhone}
                salesman={printData.salesman}
                slipTs={printData.slipTs}
                billId={printData.billId}
                rooms={printData.rooms}
              />
            </div>
          </div>

          <div className="p-3 sm:p-4 border-t border-[#dce3e0] bg-white flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-[#0f5c4c] hover:bg-[#0b4a3d] text-white font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button
              type="button"
              disabled={downloadingPng}
              onClick={handlePngDownload}
              className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl border border-[#0f5c4c] text-[#0f5c4c] bg-white hover:bg-[#e6f4f1] font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {downloadingPng ? 'तयार होत आहे...' : 'फोटो डाउनलोड (PNG)'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (dialog.type === 'billPreview') {
    const file = new File([dialog.blob], dialog.fileName, { type: 'image/png' });
    const canNativeShare =
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] });

    const handleDownload = () => {
      const a = document.createElement('a');
      a.href = dialog.imageUrl;
      a.download = dialog.fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 500);
      onToast('Bill फोटो डाउनलोड झाला');
    };

    const handleShare = async () => {
      try {
        await navigator.share({ files: [file], title: 'Estimate Slip' });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        handleDownload();
      }
    };

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 no-print"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl border border-[#dce3e0] shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#dce3e0]">
            <h3 className="text-base font-bold text-[#182220]">Bill फोटो प्रीव्ह्यू</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="बंद करा"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#64748b] hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 overflow-y-auto bg-[#f4f6f5] flex-1">
            <img
              src={dialog.imageUrl}
              alt="Estimate Bill Preview"
              className="w-full h-auto rounded-lg border border-[#dce3e0] bg-white"
            />
          </div>
          <div className="p-4 border-t border-[#dce3e0] bg-white flex flex-wrap gap-2">
            {canNativeShare && (
              <button
                type="button"
                onClick={handleShare}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0f5c4c] text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform whitespace-nowrap"
              >
                <Share2 className="w-4 h-4" />
                WhatsApp / शेअर
              </button>
            )}
            <button
              type="button"
              onClick={handleDownload}
              className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform whitespace-nowrap ${
                canNativeShare
                  ? 'border border-[#0f5c4c] text-[#0f5c4c] bg-white hover:bg-[#e6f4f1]'
                  : 'bg-[#0f5c4c] text-white'
              }`}
            >
              <Download className="w-4 h-4" />
              फोटो डाउनलोड करा
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 no-print"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-[#dce3e0] shadow-xl w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-[#182220] mb-1.5">{dialog.title}</h3>
        <p className="text-sm text-[#52605d] whitespace-pre-line mb-4">{dialog.message}</p>

        {dialog.type === 'prompt' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              dialog.onConfirm(promptVal);
              onClose();
            }}
          >
            <input
              type={dialog.inputType || 'text'}
              inputMode={dialog.inputType === 'number' ? 'decimal' : 'text'}
              value={promptVal}
              placeholder={dialog.placeholder}
              onChange={(e) => setPromptVal(e.target.value)}
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#cbd5d1] text-base text-[#182220] focus:outline-none focus:border-[#0f5c4c] focus:ring-2 focus:ring-[#0f5c4c]/15 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[#dce3e0] text-sm font-semibold text-[#52605d] hover:bg-slate-50 whitespace-nowrap"
              >
                रद्द करा
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0f5c4c] text-white text-sm font-bold hover:bg-[#0b4a3d] whitespace-nowrap"
              >
                {dialog.confirmLabel || 'सेव्ह करा'}
              </button>
            </div>
          </form>
        )}

        {dialog.type === 'confirm' && (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#dce3e0] text-sm font-semibold text-[#52605d] hover:bg-slate-50 whitespace-nowrap"
            >
              नाही
            </button>
            <button
              type="button"
              onClick={() => {
                dialog.onConfirm();
                onClose();
              }}
              className={`min-h-[44px] px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${
                dialog.danger
                  ? 'bg-[#dc2626] text-white hover:bg-[#b91c1c]'
                  : 'bg-[#0f5c4c] text-white hover:bg-[#0b4a3d]'
              }`}
            >
              {dialog.confirmLabel || 'होय, पुढे जा'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
