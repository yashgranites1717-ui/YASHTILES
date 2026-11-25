import { DEFAULT_PICS_BY_SIZE, GROUPS, buildSeed } from '../data/seed';
import type { CalcKind, EstimateItem, GroupId, Product, SavedBill } from '../types';

export const STORAGE_KEYS = {
  products: 'ytg_products_v2',
  legacyProducts: 'yash_tiles_products',
  bills: 'yash_tiles_bills',
  shop: 'yash_tiles_shop',
  salesman: 'ytg_salesman',
  salesmen: 'ytg_salesmen',
  draft: 'ytg_draft',
  unit: 'ytg_unit',
} as const;

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

export function storeJson(key: string, val: unknown): boolean {
  try {
    localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
    return true;
  } catch {
    return false;
  }
}

export function fmt(n: number | string | undefined): string {
  return Math.round(Number(n) || 0).toLocaleString('en-IN');
}

export function fr(n: number | string | undefined): number {
  return Number((Number(n) || 0).toFixed(2));
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function dkey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fdate(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function ftime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function kindOf(p: Pick<Product, 'group'>): CalcKind {
  return (GROUPS[p.group] || GROUPS.tiles).kind;
}

export function picsOf(p: Product): number {
  if (p.pics && p.pics > 0) return p.pics;
  const pm = p.name.match(/\((\d+)\s*pic\)/i);
  if (pm) return +pm[1];
  const ms = [...p.name.matchAll(/(\d+)\s*[xX*]\s*(\d+)/g)];
  const m = ms[ms.length - 1];
  return m ? DEFAULT_PICS_BY_SIZE[`${+m[1]}x${+m[2]}`] || 0 : 0;
}

export function normalizeRoom(raw: Partial<EstimateItem> & Record<string, unknown>): EstimateItem {
  const legacyTileName = typeof raw.tileName === 'string' ? raw.tileName : '';
  const legacyBoxes = typeof raw.boxes === 'number' ? raw.boxes : 0;
  const legacyBoxRate = typeof raw.boxRate === 'number' ? raw.boxRate : 0;
  const legacyRate100 = typeof raw.rate100 === 'number' ? raw.rate100 : 0;

  if (!raw.kind) {
    return {
      room: String(raw.room || 'Room'),
      group: 'tiles',
      kind: 'box',
      name: String(raw.name || legacyTileName),
      sizeText: String(raw.sizeText || ''),
      unit: 'Box',
      qty: legacyBoxes,
      unitRate: legacyBoxRate,
      amount: Number(raw.amount) || legacyBoxes * legacyBoxRate,
      rateText: `₹${legacyRate100}/100 Sq.Ft (₹${fmt(legacyBoxRate)}/Box)`,
      boxes: legacyBoxes,
    };
  }

  const kind = raw.kind;
  const qty = Number(raw.qty) || 0;
  return {
    ...(raw as EstimateItem),
    room: String(raw.room || 'Room'),
    group: GROUPS[raw.group as GroupId] ? (raw.group as GroupId) : 'tiles',
    kind,
    name: String(raw.name || ''),
    sizeText: String(raw.sizeText || ''),
    unit: String(raw.unit || (kind === 'box' ? 'Box' : kind === 'sqft' ? 'Sq.Ft' : 'नग')),
    qty,
    unitRate: Number(raw.unitRate) || 0,
    amount: Number(raw.amount) || 0,
    rateText: String(raw.rateText || ''),
    boxes: kind === 'box' ? qty : 0,
  };
}

export function normalizeBill(raw: Partial<SavedBill> & Record<string, unknown>): SavedBill {
  const ts = Number(raw.ts || raw.id) || Date.now();
  const rooms = Array.isArray(raw.rooms)
    ? raw.rooms.map((r) => normalizeRoom(r as unknown as Record<string, unknown>))
    : [];
  return {
    id: Number(raw.id) || ts,
    ts,
    date: String(raw.date || fdate(ts)),
    custName: String(raw.custName || 'Walk-in Customer'),
    custPhone: String(raw.custPhone || ''),
    salesman: String(raw.salesman || ''),
    rooms,
    totalBoxes: rooms.reduce((s, r) => s + (r.kind === 'box' ? r.qty : 0), 0),
    totalAmount: rooms.reduce((s, r) => s + r.amount, 0),
  };
}

export function loadInitialProducts(): Product[] {
  const existing = loadJson<Product[] | null>(STORAGE_KEYS.products, null);
  if (Array.isArray(existing) && existing.length > 0) {
    return existing.map((p, idx) => ({
      id: Number(p.id) || 1000 + idx,
      code: String(p.code || ''),
      name: String(p.name || ''),
      group: GROUPS[p.group] ? p.group : 'tiles',
      sqftPerBox: Number(p.sqftPerBox) || 0,
      rate: Number(p.rate) || 0,
      chk: Boolean(p.chk),
      pics: Number(p.pics) || 0,
    }));
  }

  const seeded = buildSeed();
  const legacy = loadJson<Array<{ id: number; name: string; rate100: number; sqftPerBox: number }>>(
    STORAGE_KEYS.legacyProducts,
    []
  );
  if (Array.isArray(legacy)) {
    legacy
      .filter((p) => p && p.id > 5 && p.name && p.rate100 > 0 && p.sqftPerBox > 0)
      .forEach((p) => {
        seeded.unshift({
          id: p.id,
          code: '',
          name: p.name,
          group: 'tiles',
          sqftPerBox: Number(p.sqftPerBox),
          rate: Number(p.rate100),
          chk: false,
          pics: 0,
        });
      });
  }
  storeJson(STORAGE_KEYS.products, seeded);
  return seeded;
}

export function qtyText(r: EstimateItem): string {
  return `${r.kind === 'sqft' ? fr(r.qty) : r.qty} ${r.unit}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export function downloadBlob(name: string, content: string | Blob, mime: string, bom = false): void {
  const blob = content instanceof Blob ? content : new Blob([bom ? '\uFEFF' + content : content], { type: mime });
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1500);
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function toB64(str: string): string {
  return bytesToB64(new TextEncoder().encode(str));
}

async function gzipB64(str: string): Promise<string> {
  const cs = new CompressionStream('gzip');
  const w = cs.writable.getWriter();
  w.write(new TextEncoder().encode(str));
  w.close();
  return bytesToB64(new Uint8Array(await new Response(cs.readable).arrayBuffer()));
}

async function gunzipB64(b64: string): Promise<string> {
  const ds = new DecompressionStream('gzip');
  const w = ds.writable.getWriter();
  const bytes = b64ToBytes(b64);
  w.write(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  w.close();
  return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer());
}

export async function buildRatesShareMessage(shopName: string, products: Product[]): Promise<string> {
  const payload = JSON.stringify({ v: 2, shop: shopName, ts: Date.now(), products });
  let code: string;
  try {
    if (typeof CompressionStream === 'undefined') throw new Error('No CompressionStream');
    code = 'YTG1:' + (await gzipB64(payload));
  } catch {
    code = 'YTG0:' + toB64(payload);
  }
  return `*${shopName} - नवीन Rate List*\n(${products.length} प्रोडक्ट्स | ${fdate(Date.now())})\n\nहा पूर्ण मेसेज कॉपी करा → App मध्ये 'रेट लिस्ट' → 'नवीन लिस्ट लोड करा' मध्ये पेस्ट करा:\n\n${code}`;
}

export async function parseRatesImportCode(
  raw: string
): Promise<{ shop?: string; products: Product[] }> {
  const i = raw.indexOf('YTG');
  if (i < 0) {
    throw new Error('चुकीचा कोड! WhatsApp वरील पूर्ण मेसेज कॉपी करून पेस्ट करा.');
  }
  const m = raw
    .slice(i)
    .replace(/\s+/g, '')
    .match(/^YTG([01]):([A-Za-z0-9+/]+={0,2})/);
  if (!m) {
    throw new Error('कोड वाचता आला नाही. पूर्ण मेसेज कॉपी करा.');
  }

  let json: string;
  if (m[1] === '1') {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('या ब्राउझरमध्ये gzip सपोर्ट नाही.');
    }
    json = await gunzipB64(m[2]);
  } else {
    json = new TextDecoder().decode(b64ToBytes(m[2]));
  }

  const data = JSON.parse(json) as { shop?: string; products?: Array<Partial<Product>> };
  if (!Array.isArray(data.products) || !data.products.length) {
    throw new Error('कोडमध्ये प्रोडक्ट लिस्ट सापडली नाही.');
  }

  const seen = new Set<number>();
  const list: Product[] = data.products
    .filter((p) => p && p.name)
    .map((p, n) => {
      let id = Number(p.id) || Date.now() + n;
      while (seen.has(id)) id++;
      seen.add(id);
      return {
        id,
        code: String(p.code || ''),
        name: String(p.name),
        group: p.group && GROUPS[p.group] ? p.group : 'tiles',
        sqftPerBox: Number(p.sqftPerBox) || 0,
        rate: Number(p.rate) || 0,
        chk: Boolean(p.chk),
        pics: Number(p.pics) || 0,
      };
    });

  if (!list.length) {
    throw new Error('कोडमध्ये वैध प्रोडक्ट नाहीत.');
  }
  return { shop: data.shop ? String(data.shop) : undefined, products: list };
}

export async function renderBillToPngBlob(params: {
  shopName: string;
  custName: string;
  custPhone: string;
  salesman: string;
  slipTs: number;
  billId?: number | null;
  items: EstimateItem[];
}): Promise<{ blob: Blob; fileName: string }> {
  const { shopName, custName, custPhone, salesman, slipTs, billId, items } = params;
  const FONT = "'Plus Jakarta Sans','Noto Sans Devanagari',system-ui,sans-serif";
  const W = 940;
  const P = 36;
  const LW = 450;
  const cust = custName.trim() || 'Walk-in Customer';
  const sales = salesman.trim() || '---';
  const estNo = `EST-${String(billId || slipTs).slice(-6)}`;
  const totalBoxes = items.reduce((s, r) => s + (r.kind === 'box' ? r.qty : 0), 0);
  const totalAmount = items.reduce((s, r) => s + r.amount, 0);

  const mc = document.createElement('canvas').getContext('2d');
  if (!mc) throw new Error('Canvas not supported');

  const wrap = (txt: string, maxW: number, font: string): string[] => {
    mc.font = font;
    const out: string[] = [];
    let cur = '';
    for (const word of String(txt).split(/\s+/)) {
      const candidate = cur ? `${cur} ${word}` : word;
      if (mc.measureText(candidate).width > maxW && cur) {
        out.push(cur);
        cur = word;
      } else {
        cur = candidate;
      }
    }
    if (cur) out.push(cur);
    return out.length ? out : [''];
  };

  const rows = items.map((r, i) => {
    const titleLines = wrap(`${i + 1}. ${r.room} — ${r.name}`, LW, `700 17px ${FONT}`);
    const subLines = wrap([r.sizeText, r.rateText].filter(Boolean).join(' · '), LW, `14px ${FONT}`);
    return {
      r,
      titleLines,
      subLines,
      h: Math.max(54, titleLines.length * 23 + subLines.length * 19 + 18),
    };
  });

  const tableTop = 232;
  const tableRowsH = rows.reduce((s, x) => s + x.h, 0);
  const H = tableTop + 38 + tableRowsH + 175;
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  const x = c.getContext('2d');
  if (!x) throw new Error('Canvas context unavailable');

  x.scale(2, 2);
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, W, H);

  // Top emerald stripe & letterhead
  x.fillStyle = '#0f5c4c';
  x.fillRect(0, 0, W, 10);

  x.fillStyle = '#0f5c4c';
  x.textAlign = 'left';
  x.textBaseline = 'alphabetic';
  x.font = `800 30px ${FONT}`;
  x.fillText(shopName, P, 58);

  x.fillStyle = '#52605d';
  x.font = `600 14px ${FONT}`;
  x.fillText('टाईल्स · ग्रॅनाईट · सॅनिटरीवेअर · कडप्पा शोरूम', P, 82);

  // Right Estimate badge
  x.fillStyle = '#0f5c4c';
  x.fillRect(W - P - 220, 30, 220, 32);
  x.fillStyle = '#ffffff';
  x.textAlign = 'center';
  x.font = `800 14px ${FONT}`;
  x.fillText('ESTIMATE / QUOTATION', W - P - 110, 51);

  x.fillStyle = '#475569';
  x.textAlign = 'right';
  x.font = `600 14px ${FONT}`;
  x.fillText(`क्रमांक: ${estNo}`, W - P, 82);

  // Divider line
  x.strokeStyle = '#0f5c4c';
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(P, 98);
  x.lineTo(W - P, 98);
  x.stroke();

  // Two-column metadata cards
  const boxW = (W - 2 * P - 16) / 2;
  x.fillStyle = '#f8faf9';
  x.strokeStyle = '#dce3e0';
  x.lineWidth = 1;
  x.fillRect(P, 114, boxW, 90);
  x.strokeRect(P, 114, boxW, 90);
  x.fillRect(P + boxW + 16, 114, boxW, 90);
  x.strokeRect(P + boxW + 16, 114, boxW, 90);

  x.textAlign = 'left';
  x.fillStyle = '#0f5c4c';
  x.font = `700 12px ${FONT}`;
  x.fillText('कस्टमर माहिती (Customer)', P + 14, 136);
  x.fillStyle = '#182220';
  x.font = `700 17px ${FONT}`;
  x.fillText(cust, P + 14, 162);
  x.fillStyle = '#475569';
  x.font = `500 14px ${FONT}`;
  x.fillText(`मोबाईल: ${custPhone.trim() || '---'}`, P + 14, 186);

  const rx = P + boxW + 30;
  x.fillStyle = '#0f5c4c';
  x.font = `700 12px ${FONT}`;
  x.fillText('अंदाजपत्रक तपशील (Details)', rx, 136);
  x.fillStyle = '#182220';
  x.font = `600 15px ${FONT}`;
  x.fillText(`तारीख: ${fdate(slipTs)} · ${ftime(slipTs)}`, rx, 162);
  x.fillStyle = '#475569';
  x.font = `500 14px ${FONT}`;
  x.fillText(`विक्रेता: ${sales}`, rx, 186);

  // Table header
  let y = tableTop;
  x.fillStyle = '#0f5c4c';
  x.fillRect(P, y - 24, W - 2 * P, 36);
  x.fillStyle = '#ffffff';
  x.font = `700 14px ${FONT}`;
  x.textAlign = 'left';
  x.fillText('रूम / वस्तू व तपशील', P + 12, y - 1);
  x.textAlign = 'right';
  x.fillText('Qty', 630, y - 1);
  x.fillText('दर (Rate)', 755, y - 1);
  x.fillText('रक्कम (₹)', W - P - 12, y - 1);
  y += 12;

  rows.forEach((it, idx) => {
    if (idx % 2 === 1) {
      x.fillStyle = '#f8faf9';
      x.fillRect(P, y, W - 2 * P, it.h);
    }
    x.textAlign = 'left';
    x.fillStyle = '#182220';
    x.font = `700 17px ${FONT}`;
    let ty = y + 6;
    it.titleLines.forEach((line) => {
      ty += 23;
      x.fillText(line, P + 12, ty - 4);
    });
    x.fillStyle = '#52605d';
    x.font = `400 14px ${FONT}`;
    it.subLines.forEach((line) => {
      ty += 19;
      x.fillText(line, P + 12, ty - 4);
    });
    x.fillStyle = '#182220';
    x.textAlign = 'right';
    x.font = `700 15px ${FONT}`;
    x.fillText(qtyText(it.r), 630, y + 28);
    x.fillStyle = '#334155';
    x.font = `600 15px ${FONT}`;
    x.fillText(`₹${fmt(it.r.unitRate)}`, 755, y + 28);
    x.fillStyle = '#182220';
    x.font = `800 16px ${FONT}`;
    x.fillText(`₹${fmt(it.r.amount)}`, W - P - 12, y + 28);

    y += it.h;
    x.strokeStyle = '#cbd5e1';
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(P, y);
    x.lineTo(W - P, y);
    x.stroke();
  });

  // Terms + Summary bar
  y += 18;
  x.fillStyle = '#52605d';
  x.textAlign = 'left';
  x.font = `600 13px ${FONT}`;
  x.fillText('• हे केवळ अंदाजे कोटेशन आहे; अंतिम बिल प्रत्यक्ष मोजमापानुसार असेल.', P, y + 18);
  x.fillText('• माल तपासणी करूनच उतरवून घ्यावा. ट्रान्सपोर्ट व हमाली वेगळी राहील.', P, y + 40);

  const sumW = 340;
  const sumX = W - P - sumW;
  x.fillStyle = '#0f5c4c';
  x.fillRect(sumX, y, sumW, 56);
  x.fillStyle = '#d1fae5';
  x.font = `700 14px ${FONT}`;
  x.textAlign = 'left';
  x.fillText(
    totalBoxes > 0 ? `एकूण Boxes: ${totalBoxes}` : `एकूण आयटम्स: ${items.length}`,
    sumX + 14,
    y + 23
  );
  x.fillStyle = '#ffffff';
  x.font = `800 20px ${FONT}`;
  x.textAlign = 'right';
  x.fillText(`एकूण: ₹${fmt(totalAmount)}`, W - P - 14, y + 44);

  // Signature Footer
  y += 116;
  x.strokeStyle = '#94a3b8';
  x.beginPath();
  x.moveTo(P, y);
  x.lineTo(P + 180, y);
  x.moveTo(W - P - 220, y);
  x.lineTo(W - P, y);
  x.stroke();

  x.fillStyle = '#52605d';
  x.font = `600 13px ${FONT}`;
  x.textAlign = 'left';
  x.fillText('कस्टमर सही', P, y + 18);
  x.textAlign = 'center';
  x.fillStyle = '#0f5c4c';
  x.fillText('धन्यवाद! पुन्हा भेट द्या.', W / 2, y + 18);
  x.textAlign = 'right';
  x.fillStyle = '#52605d';
  x.fillText(`अधिकृत स्वाक्षरी (${shopName})`, W - P, y + 18);

  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
  if (!blob) throw new Error('फोटो तयार झाला नाही');

  const safeCust = cust !== 'Walk-in Customer' ? `${cust.replace(/[^\w\u0900-\u097F]+/g, '_')}_` : '';
  const fileName = `Estimate_${safeCust}${dkey(slipTs)}.png`;
  return { blob, fileName };
}
