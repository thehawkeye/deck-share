import { Resend } from "resend";

let _resend: Resend | null = null;
function resend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set");
    _resend = new Resend(apiKey);
  }
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? "noreply@muralikrishnan.net";
const BASE_URL = process.env.NEXT_PUBLIC_DECKS_URL ?? "http://localhost:3000";

export interface MagicLinkEmail {
  to: string;
  title: string;
  filename: string;
  token: string;
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendMagicLinkEmail({ to, title, filename, token }: MagicLinkEmail): Promise<void> {
  const link = `${BASE_URL}/api/decks/${encodeURIComponent(filename)}/token?token=${token}`;

  await resend().emails.send({
    from: FROM,
    to,
    subject: `Deck Access: ${title}`,
    html: `
      <div style="margin:0;padding:28px 14px;background:#050507;font-family:Outfit,Arial,sans-serif;color:#f4f4f5;">
        <div style="max-width:620px;margin:0 auto;border:1px solid rgba(255,255,255,0.08);border-radius:16px;background:#111115;overflow:hidden;">
          <div style="padding:24px 24px 16px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0 0 8px;color:#c9a962;letter-spacing:0.14em;text-transform:uppercase;font-size:11px;">Deck Share • Hawkeye</p>
            <h1 style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:34px;line-height:0.95;font-weight:600;color:#f4f4f5;">${esc(title)}</h1>
          </div>

          <div style="padding:18px 24px 8px;">
            <p style="margin:0 0 14px;color:#d8d8dc;font-size:14px;line-height:1.6;">
              Your access link is ready. This link is private, valid for 24 hours, and can be used once.
            </p>

            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px;">
              <tr>
                <td style="border-radius:8px;background:#c9a962;">
                  <a href="${link}" style="display:inline-block;padding:11px 18px;border-radius:8px;color:#050507;text-decoration:none;font-weight:700;font-size:14px;">
                    Open Deck
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:#6b6b70;font-size:12px;line-height:1.6;font-family:'JetBrains Mono',monospace;">
              ${esc(filename)}
            </p>
          </div>

          <div style="padding:14px 24px 20px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;color:#8d8d93;font-size:12px;line-height:1.6;">
              If the button does not work, copy and paste this URL into your browser:<br>
              <a href="${link}" style="color:#c9a962;word-break:break-all;text-decoration:none;">${link}</a>
            </p>
          </div>
        </div>
      </div>
    `,
  });
}
