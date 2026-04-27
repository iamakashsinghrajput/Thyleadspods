export const LOGO_PNG_SIZE = 64;
export const ICON_PX = 18;

export const PHONE_COUNTRY_CODE = "+91";

export const THYLEADS_ADDRESS_LINES: string[] = [
  "#164, 1st Cross, 1st Main Road",
  "AECS Layout, Sanjay Nagar",
  "Bengaluru, Karnataka 560094, IN",
];

export const THYLEADS_DISCLAIMER =
  "The content of this email is confidential and intended for the recipient specified in message only. It is strictly forbidden to share any part of this message with any third party, without a written consent of the sender. If you received this message by mistake, please reply to this message and follow with its deletion, so that we can ensure such a mistake does not occur in the future.";

export interface SignatureRecord {
  personName: string;
  position: string;
  phone: string;
  linkedInUrl: string;
  websiteUrl: string;
}

export interface EmailAssets {
  logo?: string;
  linkedIn?: string;
  globe?: string;
  phone?: string;
}

let cachedLogoPng: string | null = null;
let cachedLinkedInPng: string | null = null;
let cachedGlobePng: string | null = null;
let cachedPhonePng: string | null = null;

export function normalizePhoneDigits(input: string): string {
  if (!input) return "";
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length > 10) {
    return digits.slice(digits.length - 10);
  }
  return digits.length > 10 ? digits.slice(digits.length - 10) : digits;
}

export function formatIndianPhone(input: string): string {
  const digits = normalizePhoneDigits(input);
  if (!digits) return "";
  if (digits.length === 10) {
    return `${PHONE_COUNTRY_CODE} ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return `${PHONE_COUNTRY_CODE} ${digits}`;
}

async function svgToPngDataUri(svg: string, width: number, height: number): Promise<string> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg load failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d ctx");
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function buildLogoPngDataUri(): Promise<string> {
  if (cachedLogoPng) return cachedLogoPng;
  const size = LOGO_PNG_SIZE * 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 78 78"><path d="M33.54 78V20.0792H12.48V10.8119H67.86V27.0297H78V0H0V30.8911H21.84V78H33.54Z" fill="#6800FF"/><path d="M55.38 20.0792H43.68V78H78V68.7327H55.38V20.0792Z" fill="#6800FF"/></svg>`;
  cachedLogoPng = await svgToPngDataUri(svg, size, size);
  return cachedLogoPng;
}

export async function buildLinkedInPngDataUri(): Promise<string> {
  if (cachedLinkedInPng) return cachedLinkedInPng;
  const size = ICON_PX * 4;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#0A66C2"/><circle cx="7.1" cy="7.6" r="1.55" fill="#ffffff"/><rect x="5.6" y="9.7" width="3" height="9" fill="#ffffff"/><path fill="#ffffff" d="M10.6 9.7h2.85v1.25h.04c.4-.72 1.36-1.45 2.81-1.45 3 0 3.55 1.85 3.55 4.25V18.7h-3v-3.95c0-.95-.02-2.15-1.4-2.15-1.4 0-1.62 1-1.62 2.05V18.7h-3V9.7z"/></svg>`;
  cachedLinkedInPng = await svgToPngDataUri(svg, size, size);
  return cachedLinkedInPng;
}

export async function buildGlobePngDataUri(): Promise<string> {
  if (cachedGlobePng) return cachedGlobePng;
  const size = ICON_PX * 3;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#3b82f6"/><circle cx="12" cy="12" r="9.5" fill="none" stroke="white" stroke-width="0.5"/><path d="M2 12h20" stroke="white" stroke-width="1.2" stroke-linecap="round"/><ellipse cx="12" cy="12" rx="4" ry="10" stroke="white" stroke-width="1.2" fill="none"/></svg>`;
  cachedGlobePng = await svgToPngDataUri(svg, size, size);
  return cachedGlobePng;
}

export async function buildPhonePngDataUri(): Promise<string> {
  if (cachedPhonePng) return cachedPhonePng;
  const size = ICON_PX * 3;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" fill="#6800FF"/></svg>`;
  cachedPhonePng = await svgToPngDataUri(svg, size, size);
  return cachedPhonePng;
}

export async function resolveEmailAssets(): Promise<EmailAssets> {
  const [logo, linkedIn, globe, phone] = await Promise.all([
    buildLogoPngDataUri().catch(() => undefined),
    buildLinkedInPngDataUri().catch(() => undefined),
    buildGlobePngDataUri().catch(() => undefined),
    buildPhonePngDataUri().catch(() => undefined),
  ]);
  return { logo, linkedIn, globe, phone };
}

export function normalizeWebsiteHref(url: string): string {
  if (!url) return "";
  const apex = url.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
  return apex ? `https://${apex}/` : "";
}

export function renderSignatureHtml(sig: SignatureRecord, assets: EmailAssets = {}): string {
  const { logo, linkedIn, globe, phone } = assets;
  const websiteHref = normalizeWebsiteHref(sig.websiteUrl);
  const websiteText = sig.websiteUrl ? sig.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";
  const formattedPhone = formatIndianPhone(sig.phone);

  // Icon + text pairs are rendered as inline-block 2-cell tables so vertical
  // alignment is exact across Gmail web, Gmail mobile, Apple Mail, and Outlook.
  // Inline `vertical-align: middle` on <img> + <span> aligns to the text's
  // x-height, not its visual middle, which is why the icon looked lifted.
  const iconTextPair = (iconHtml: string, textHtml: string, gap = 6) =>
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="display:inline-table;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">` +
      `<tr>` +
        `<td style="vertical-align:middle;padding-right:${gap}px;line-height:0;font-size:0;">${iconHtml}</td>` +
        `<td style="vertical-align:middle;">${textHtml}</td>` +
      `</tr>` +
    `</table>`;

  const linkedInPair = sig.linkedInUrl && linkedIn
    ? iconTextPair(
        `<img src="${linkedIn}" alt="" width="${ICON_PX}" height="${ICON_PX}" style="display:block;border:0;outline:none;"/>`,
        `<span style="color:#0f172a;text-decoration:underline;font-weight:700;font-size:12px;line-height:1;font-family:Inter,Arial,sans-serif;white-space:nowrap;">Linkedin</span>`,
      )
    : (sig.linkedInUrl
        ? `<span style="color:#0f172a;text-decoration:underline;font-weight:700;font-size:12px;font-family:Inter,Arial,sans-serif;">Linkedin</span>`
        : "");
  const linkedInLink = sig.linkedInUrl
    ? `<a href="${sig.linkedInUrl}" style="text-decoration:none;color:inherit;display:inline-block;vertical-align:middle;">${linkedInPair}</a>`
    : "";

  const websitePair = sig.websiteUrl && globe
    ? iconTextPair(
        `<img src="${globe}" alt="" width="${ICON_PX}" height="${ICON_PX}" style="display:block;border:0;outline:none;"/>`,
        `<span style="color:#0f172a;text-decoration:underline;font-weight:700;font-size:12px;line-height:1;font-family:Inter,Arial,sans-serif;word-break:break-all;">${websiteText}</span>`,
      )
    : (sig.websiteUrl
        ? `<span style="color:#0f172a;text-decoration:underline;font-weight:700;font-size:12px;font-family:Inter,Arial,sans-serif;word-break:break-all;">${websiteText}</span>`
        : "");
  const websiteLink = sig.websiteUrl
    ? `<a href="${websiteHref}" style="text-decoration:none;color:inherit;display:inline-block;vertical-align:middle;">${websitePair}</a>`
    : "";

  const sep = sig.linkedInUrl && sig.websiteUrl
    ? `<span style="display:inline-block;vertical-align:middle;color:#cbd5e1;margin:0 8px;font-weight:300;font-size:14px;line-height:1;">|</span>`
    : "";

  const logoCell = logo
    ? `<img src="${logo}" alt="Thyleads logo" width="${LOGO_PNG_SIZE}" height="${LOGO_PNG_SIZE}" style="display:block;border:0;outline:none;margin:0 auto;"/>`
    : `<div style="width:${LOGO_PNG_SIZE}px;height:${LOGO_PNG_SIZE}px;background:#6800FF;border-radius:8px;margin:0 auto;"></div>`;

  const phoneRow = formattedPhone
    ? `<div style="margin-top:8px;font-family:Inter,Arial,sans-serif;">` +
        (phone
          ? iconTextPair(
              `<img src="${phone}" alt="" width="14" height="14" style="display:block;border:0;outline:none;"/>`,
              `<span style="color:#334155;font-size:12px;line-height:1;font-family:Inter,Arial,sans-serif;">${formattedPhone}</span>`,
            )
          : `<span style="color:#334155;font-size:12px;line-height:1;font-family:Inter,Arial,sans-serif;">${formattedPhone}</span>`) +
      `</div>`
    : "";

  const addressRow = THYLEADS_ADDRESS_LINES.length > 0
    ? `<div style="margin-top:4px;color:#64748b;font-size:11px;line-height:1.3;font-family:Inter,Arial,sans-serif;">${THYLEADS_ADDRESS_LINES.map((line) => `<div>${line}</div>`).join("")}</div>`
    : "";

  // Outer card wrapper. Forces a white surface that survives Gmail dark-mode
  // partial inversion, with explicit border + radius + subtle shadow that
  // common clients (Gmail web/iOS/Android, Apple Mail, Outlook 365) respect.
  const disclaimer = THYLEADS_DISCLAIMER
    ? `<div style="max-width:720px;margin-top:10px;padding:0 4px;font-family:Inter,Arial,sans-serif;font-size:10px;line-height:1.5;color:#94a3b8;font-style:italic;">${THYLEADS_DISCLAIMER}</div>`
    : "";

  return `
<div style="font-family:Inter,Arial,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:separate;background-color:#ffffff;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 1px 3px rgba(15,23,42,0.06);mso-table-lspace:0pt;mso-table-rspace:0pt;color-scheme:light only;">
  <tr>
    <td bgcolor="#ffffff" style="background-color:#ffffff;background:#ffffff;padding:14px 26px;border-radius:14px;">
      <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;font-family:Inter,Arial,sans-serif;color:#0f172a;width:100%;max-width:720px;">
        <tr>
          <td style="vertical-align:middle;padding:4px 26px 4px 4px;text-align:center;border-right:1px solid #cbd5e1;width:38%;">
            ${logoCell}
            <div style="font-size:26px;font-weight:800;color:#0f172a;line-height:1;margin-top:6px;letter-spacing:-0.5px;font-family:Inter,Arial,sans-serif;">Thyleads</div>
            <div style="font-size:11px;color:#475569;margin-top:10px;font-weight:500;font-family:Inter,Arial,sans-serif;letter-spacing:0.2px;text-transform:uppercase;">Trusted by Top SaaS Companies</div>
          </td>
          <td style="vertical-align:middle;padding:4px 4px 4px 26px;">
            <div style="font-size:22px;font-weight:800;color:#6800FF;line-height:1.1;font-family:Inter,Arial,sans-serif;">${sig.personName}</div>
            <div style="font-size:14px;font-weight:700;color:#0f172a;margin-top:2px;line-height:1.2;font-family:Inter,Arial,sans-serif;">${sig.position}</div>
            ${phoneRow}
            ${addressRow}
            <div style="margin-top:10px;font-size:12px;line-height:1.4;font-family:Inter,Arial,sans-serif;">${linkedInLink}${sep}${websiteLink}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
${disclaimer}
</div>`.trim();
}
