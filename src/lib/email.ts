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

export async function sendMagicLinkEmail({ to, title, filename, token }: MagicLinkEmail): Promise<void> {
  const link = `${BASE_URL}/api/decks/${encodeURIComponent(filename)}/token?token=${token}`;

  await resend().emails.send({
    from: FROM,
    to,
    subject: `Your access to ${title}`,
    html: `
    <div style="font-family: Outfit, Arial, sans-serif; background: #050507; color: #f4f4f5; padding: 2rem; max-width: 560px; margin: 0 auto;">
      <div style="border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 2.5rem; text-align: center;">
        <p style="color: #c9a962; letter-spacing: 0.1em; text-transform: uppercase; font-size: 0.75rem; margin: 0 0 1.5rem;">Deck Share</p>
        <h1 style="font-family: Cormorant Garamond, Georgia, serif; font-size: 1.8rem; font-weight: 600; margin: 0 0 0.5rem; color: #f4f4f5;">${title}</h1>
        <p style="color: #6b6b70; margin: 0 0 2rem; font-size: 0.95rem;">You have been granted access.</p>
        <a href="${link}" style="display:inline-block; background: #c9a962; color: #050507; text-decoration: none; font-weight: 600; padding: 0.75rem 1.5rem; border-radius: 8px; font-size: 0.95rem;">Open Deck</a>
        <p style="color: #6b6b70; font-size: 0.8rem; margin: 1.5rem 0 0;">This link expires in 24 hours and can only be used once.</p>
      </div>
    </div>
    `,
  });
}
