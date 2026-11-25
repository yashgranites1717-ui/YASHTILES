import type { EstimateItem } from '../types';
import { fdate, fmt, ftime, qtyText } from '../utils/storage';

interface PrintEstimateTemplateProps {
  shopName: string;
  custName: string;
  custPhone: string;
  salesman: string;
  slipTs: number;
  billId: number | null;
  rooms: EstimateItem[];
}

export function PrintEstimateTemplate({
  shopName,
  custName,
  custPhone,
  salesman,
  slipTs,
  billId,
  rooms,
}: PrintEstimateTemplateProps) {
  const totalBoxes = rooms.reduce((s, r) => s + (r.kind === 'box' ? r.qty : 0), 0);
  const totalAmount = rooms.reduce((s, r) => s + r.amount, 0);
  const estimateNo = `EST-${String(billId || slipTs).slice(-6)}`;

  return (
    <div className="bg-white text-[#182220] w-full max-w-[794px] mx-auto border border-[#cbd5e1] print:border-0 print:max-w-none print:w-full">
      {/* Top Emerald Brand Accent */}
      <div className="h-2 bg-[#0f5c4c] w-full" />

      <div className="p-6 sm:p-8 print:p-0 print:pt-4">
        {/* Letterhead Header */}
        <div className="flex flex-col sm:flex-row print:flex-row justify-between items-start sm:items-center print:items-center gap-4 pb-4 border-b-2 border-[#0f5c4c]">
          <div>
            <h1 className="text-2xl sm:text-[26px] font-extrabold text-[#0f5c4c] tracking-tight leading-tight">
              {shopName}
            </h1>
            <p className="text-xs font-semibold text-[#52605d] mt-1">
              टाईल्स · ग्रॅनाईट · सॅनिटरीवेअर · कडप्पा शोरूम
            </p>
          </div>
          <div className="sm:text-right print:text-right">
            <div className="inline-block bg-[#0f5c4c] text-white px-3.5 py-1 rounded text-xs font-extrabold tracking-widest uppercase">
              ESTIMATE / QUOTATION
            </div>
            <div className="text-xs text-[#475569] mt-1.5 font-mono-num tabular-nums">
              क्रमांक: <span className="font-bold text-[#182220]">{estimateNo}</span>
            </div>
          </div>
        </div>

        {/* Customer & Estimate Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-3 my-4">
          <div className="bg-[#f8faf9] border border-[#dce3e0] rounded-lg p-3">
            <div className="text-[11px] font-bold text-[#0f5c4c] mb-1">
              कस्टमर माहिती (Customer)
            </div>
            <div className="text-sm font-bold text-[#182220]">
              {custName.trim() || 'Walk-in Customer'}
            </div>
            <div className="text-xs text-[#475569] mt-0.5 tabular-nums">
              मोबाईल: {custPhone.trim() || '---'}
            </div>
          </div>

          <div className="bg-[#f8faf9] border border-[#dce3e0] rounded-lg p-3">
            <div className="text-[11px] font-bold text-[#0f5c4c] mb-1">
              अंदाजपत्रक तपशील (Details)
            </div>
            <div className="text-xs text-[#182220] tabular-nums">
              तारीख: <span className="font-bold">{fdate(slipTs)}</span> ·{' '}
              <span className="text-[#64748b]">{ftime(slipTs)}</span>
            </div>
            <div className="text-xs text-[#475569] mt-0.5">
              विक्रेता (Salesman): <span className="font-semibold text-[#182220]">{salesman.trim() || '---'}</span>
            </div>
          </div>
        </div>

        {/* Itemized Table */}
        <table className="w-full border-collapse text-xs sm:text-[13px] border border-[#cbd5e1]">
          <thead>
            <tr className="bg-[#0f5c4c] text-white text-left">
              <th className="py-2.5 px-2.5 font-bold border border-[#0f5c4c] w-10 text-center">क्र.</th>
              <th className="py-2.5 px-2.5 font-bold border border-[#0f5c4c]">रूम व माप</th>
              <th className="py-2.5 px-2.5 font-bold border border-[#0f5c4c]">वस्तूचे नाव व दर</th>
              <th className="py-2.5 px-2.5 font-bold border border-[#0f5c4c] text-right whitespace-nowrap">
                प्रमाण (Qty)
              </th>
              <th className="py-2.5 px-2.5 font-bold border border-[#0f5c4c] text-right whitespace-nowrap">
                दर (Rate)
              </th>
              <th className="py-2.5 px-2.5 font-bold border border-[#0f5c4c] text-right whitespace-nowrap">
                रक्कम (₹)
              </th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r, i) => (
              <tr
                key={`${r.name}-${i}`}
                className="even:bg-[#f8faf9] break-inside-avoid align-top"
              >
                <td className="py-2.5 px-2.5 border border-[#cbd5e1] text-center font-semibold text-[#475569] tabular-nums">
                  {i + 1}
                </td>
                <td className="py-2.5 px-2.5 border border-[#cbd5e1]">
                  <div className="font-bold text-[#182220]">{r.room}</div>
                  {r.sizeText && (
                    <div className="text-[11px] text-[#52605d] mt-0.5">{r.sizeText}</div>
                  )}
                </td>
                <td className="py-2.5 px-2.5 border border-[#cbd5e1]">
                  <div className="font-bold text-[#182220]">{r.name}</div>
                  <div className="text-[11px] text-[#52605d] mt-0.5">{r.rateText}</div>
                </td>
                <td className="py-2.5 px-2.5 border border-[#cbd5e1] text-right font-bold text-[#182220] whitespace-nowrap tabular-nums">
                  {qtyText(r)}
                </td>
                <td className="py-2.5 px-2.5 border border-[#cbd5e1] text-right text-[#334155] whitespace-nowrap tabular-nums">
                  ₹{fmt(r.unitRate)}
                </td>
                <td className="py-2.5 px-2.5 border border-[#cbd5e1] text-right font-extrabold text-[#182220] whitespace-nowrap tabular-nums">
                  ₹{fmt(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Summary & Terms */}
        <div className="grid grid-cols-1 sm:grid-cols-12 print:grid-cols-12 gap-4 mt-4 break-inside-avoid">
          <div className="sm:col-span-7 print:col-span-7 bg-[#f8faf9] border border-[#dce3e0] rounded-lg p-3">
            <div className="text-[11px] font-bold text-[#182220] mb-1">
              अटी व महत्त्वाची सूचना (Terms &amp; Notes)
            </div>
            <ul className="text-[11px] text-[#52605d] space-y-0.5 list-disc list-inside leading-relaxed">
              <li>हे केवळ अंदाजे कोटेशन (Estimate) आहे; अंतिम बिल प्रत्यक्ष मोजमाप व डिलिव्हरीनुसार असेल.</li>
              <li>माल तपासणी करूनच गाडीतून उतरवून घ्यावा; फोडलेल्या बॉक्सची जबाबदारी राहणार नाही.</li>
              <li>ट्रान्सपोर्ट व हमाली खर्च (लागू असल्यास) वेगळा राहील.</li>
            </ul>
          </div>

          <div className="sm:col-span-5 print:col-span-5 border border-[#0f5c4c]/30 rounded-lg overflow-hidden flex flex-col justify-between">
            <div className="p-3 space-y-1.5 text-xs bg-white">
              <div className="flex justify-between text-[#475569] tabular-nums">
                <span>एकूण आयटम्स:</span>
                <span className="font-bold text-[#182220]">{rooms.length}</span>
              </div>
              {totalBoxes > 0 && (
                <div className="flex justify-between text-[#475569] tabular-nums">
                  <span>एकूण बॉक्सेस (Boxes):</span>
                  <span className="font-bold text-[#182220]">{totalBoxes} Box</span>
                </div>
              )}
            </div>
            <div className="bg-[#0f5c4c] text-white px-3.5 py-2.5 flex items-center justify-between gap-2 tabular-nums">
              <span className="text-xs font-bold">एकूण रक्कम (Total)</span>
              <span className="text-lg font-extrabold">₹{fmt(totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Signature Footer */}
        <div className="grid grid-cols-3 gap-4 mt-10 pt-4 border-t border-[#dce3e0] text-[11px] text-[#52605d] break-inside-avoid">
          <div>
            <div className="h-8" />
            <div className="border-t border-[#94a3b8] pt-1 font-semibold">कस्टमर सही</div>
          </div>
          <div className="flex items-end justify-center text-center font-semibold text-[#0f5c4c]">
            धन्यवाद! पुन्हा भेट द्या.
          </div>
          <div className="text-right">
            <div className="h-8" />
            <div className="border-t border-[#94a3b8] pt-1 font-semibold">
              अधिकृत स्वाक्षरी ({shopName})
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
