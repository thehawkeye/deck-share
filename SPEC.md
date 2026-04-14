# Deck Share — SPEC.md (v4 — Production Build)

**Project:** Deck Share — Magic Link Gated HTML Presentation Hosting
**Repo:** github.com/thehawkeye/deck-share
**Stack:** Next.js 14 App Router, TypeScript, CSS Modules, Upstash Redis, Resend
**Status:** Build from this spec

---

## 1. Concept

Private deck hosting with individual magic-link credentials. Every HTML file uploaded to `/decks` is locked by default. The owner controls access per email. No shared passwords, no forwarded links. The owner has a dashboard to manage every deck, every user, every expiry.

**Recipient flow:** Magic link email → click → deck opens in a branded minimal wrapper
**Owner flow:** Dashboard → add/remove users, toggle sharing, set expiry, change mode
**Admin auth:** Separate admin login (token-based), distinct from deck access

---

## 2. Design Language

**Theme:** Dark editorial — matches hawkeye brand

| Token | Value |
|---|---|
| Background | `#050507` |
| Surface | `#111115` |
| Border | `rgba(255,255,255,0.06)` |
| Accent (gold) | `#c9a962` |
| Text primary | `#f4f4f5` |
| Text muted | `#6b6b70` |
| Error | `#ef4444` |
| Success | `#22c55e` |

**Fonts:** Cormorant Garamond (headings) + Outfit (body) via Google Fonts
**No Tailwind CSS** — use CSS Modules + CSS custom properties

---

## 3. Application Structure

```
app/
  (recipient)
    /decks/[filename]/page.tsx     — Full-screen HTML viewer with wrapper
    /decks/gate/page.tsx           — Token error display page
  (admin)
    /admin/login/page.tsx          — Admin login
    /admin/page.tsx                — Dashboard: deck list
    /admin/deck/[filename]/page.tsx — Per-deck editor
  api/
    /decks/[filename]/route.ts           — Proxy HTML file to authenticated users
    /decks/[filename]/token/route.ts    — Token validation → set access cookie
    /decks/admin/
      decks/route.ts                      — GET list, PUT create
      /[filename]/route.ts               — GET manifest, DELETE manifest
      /[filename]/emails/route.ts        — POST add (sends magic link), DELETE remove
      /[filename]/resend/route.ts        — POST resend
      /[filename]/sharing/route.ts        — PATCH toggle
      /[filename]/mode/route.ts           — PATCH mode
      /[filename]/expiresAt/route.ts     — PATCH expiry
      /[filename]/requests/route.ts     — GET pending
      /[filename]/requests/[requestId]/approve/route.ts  — POST
      /[filename]/requests/[requestId]/reject/route.ts  — POST
      /auth/login/route.ts               — POST → set admin session cookie
      /auth/logout/route.ts               — POST → clear admin session cookie
middleware.ts                              — Edge: intercept /decks/*, validate access
components/
  ui/                          — Shared primitives
  admin/                       — Admin dashboard components
  deck/                        — Deck viewer components
lib/
  kv.ts                        — Vercel KV wrapper
  auth.ts                      — Admin session helpers
  email.ts                     — Resend magic link sender
  token.ts                     — UUID token generation
  manifests.ts                 — Manifest CRUD helpers
public/
  decks/                       — Uploaded HTML files (Vercel blob or /public)
```

---

## 4. KV Schema

```
Key:                          Value:
deck:{filename}:manifest      JSON manifest
token:{uuid}                  JSON { email, filename, createdAt, expiresAt, used }
request:{filename}:{uuid}     JSON { fromEmail, requestedEmail, status, createdAt }
admin:session:{token}          JSON { createdAt, expiresAt }
```

---

## 5. Manifest Schema

```json
{
  "title": "Hermes Unbound Magazine v3",
  "mode": "locked",
  "sharingEnabled": false,
  "emails": [
    {
      "email": "rahul@example.com",
      "addedAt": "2026-04-14T10:00:00Z",
      "addedBy": "muralikrishnan@gmail.com",
      "status": "pending"
    }
  ],
  "emailDomains": [],
  "expiresAt": "2026-04-30T23:59:59Z",
  "createdAt": "2026-04-14T10:00:00Z",
  "updatedAt": "2026-04-14T10:00:00Z"
}
```

Email status: `pending` | `active` | `revoked`
Mode: `locked` | `request` | `open`
Auto-add: muralikrishnan@gmail.com on every new manifest creation

---

## 6. Recipient UI

### Deck Viewer (`/decks/[filename]`)
- Full-viewport HTML rendered in sandboxed iframe
- Top-right overlay (z-50): deck title + email of logged-in user + Share button (if sharingEnabled)
- Share button opens modal: "Enter email address" → POST to requests API
- Overlay background: `rgba(0,0,0,0.7)` — visible but does not obscure content
- Keyboard: Escape closes modal

### Gate Page (`/decks/gate?file=...&error=...`)
- Centered card on dark background
- Deck title
- Error message (one of: invalid_link, link_used, link_expired, access_revoked, deck_expired)
- No form. No indication of email registration state.
- "Contact the deck owner" link (mailto)

### Magic Link Flow
1. User clicks `muralikrishnan.net/decks/filename?token=UUID`
2. Edge middleware: token param detected → redirect to `/api/decks/filename/token?token=UUID`
3. API: validate token, set access cookie, delete token, redirect to `/decks/filename`
4. Middleware (subsequent visits): cookie valid → serve deck

---

## 7. Admin Dashboard

### Login (`/admin/login`)
- Full-page dark card
- Single input: Admin Token
- Submit → POST /api/decks/admin/auth/login
- Wrong token: "Invalid token" error, same page
- Success: redirect to /admin

### Dashboard (`/admin`)
- Header: "Deck Share" + logout button
- Stats bar: total decks, total users, pending requests
- Table: filename | title | mode badge | active/pending users | expiry | sharing toggle | actions
- "Upload New Deck" section at bottom with Vercel CLI instructions
- Empty state if no decks

### Deck Editor (`/admin/deck/[filename]`)
- Back link to /admin
- Header: title (editable inline) + mode badge + sharing toggle
- Tab 1 — Users:
  - Table: email | status badge | added by | added at | actions (resend, revoke, remove)
  - Add user form: email input + "Add & Send Magic Link" button
  - CSV bulk import button
- Tab 2 — Requests (visible if sharingEnabled):
  - Table: requested by | requested email | timestamp | actions (approve, reject)
- Tab 3 — Settings:
  - Mode selector: locked / request / open
  - Expiry date picker (with "No expiry" option)
  - Danger zone: Delete manifest (does not delete file)
- All changes save immediately (no "Save" button — optimistic UI)

---

## 8. Admin Authentication

- **Login:** POST admin token → set HttpOnly cookie `admin_session`
- **Cookie:** `admin_session` = Base64(token:timestamp), 7-day expiry, HttpOnly + Secure + SameSite=Strict
- **All /api/decks/admin/* routes:** validate cookie server-side; reject if missing or expired
- **Web /admin/* pages:** server component checks cookie; redirect to /admin/login if invalid
- **Admin token:** generated once, stored in `DECKS_ADMIN_TOKEN` env var

---

## 9. API Endpoints

### Token Validation
```
GET /api/decks/[filename]/token?token=UUID
  302 → /decks/[filename]          (success)
  302 → /decks/gate?file=...&error=invalid_link       (token not found)
  302 → /decks/gate?file=...&error=link_used         (already consumed)
  302 → /decks/gate?file=...&error=link_expired      (past expiry)
```

### Deck Proxy
```
GET /api/decks/[filename]
  200 → HTML file contents       (authenticated)
  302 → /decks/gate?file=...     (no valid cookie)
```

### Admin: Decks
```
GET /api/decks/admin/decks
  200 → { decks: [...] }

PUT /api/decks/admin/decks/[filename]
  200 → { manifest }
  (auto-adds muralikrishnan@gmail.com if not present)
```

### Admin: Emails
```
POST /api/decks/admin/decks/[filename]/emails
  Body: { emails: ["..."] }
  200 → { added: [...], alreadyExists: [...] }
  (sends magic link to each new email)

DELETE /api/decks/admin/decks/[filename]/emails
  Body: { emails: ["..."] }
  200 → { removed: [...] }
```

### Admin: Resend
```
POST /api/decks/admin/decks/[filename]/resend
  Body: { email: "..." }
  200 → { sent: true }
```

### Admin: Sharing / Mode / Expiry
```
PATCH /api/decks/admin/decks/[filename]/sharing
  Body: { sharingEnabled: bool }

PATCH /api/decks/admin/decks/[filename]/mode
  Body: { mode: "locked" | "request" | "open" }

PATCH /api/decks/admin/decks/[filename]/expiresAt
  Body: { expiresAt: ISO8601 | null }
```

### Admin: Requests
```
GET /api/decks/admin/decks/[filename]/requests
  200 → { requests: [...] }

POST /api/decks/admin/decks/[filename]/requests/[requestId]/approve
  200 → {} (sends magic link to requestedEmail)

POST /api/decks/admin/decks/[filename]/requests/[requestId]/reject
  200 → {}
```

### Admin: Auth
```
POST /api/decks/admin/auth/login
  Body: { token: "..." }
  200 → {} + Set-Cookie (valid)
  401 → { error: "invalid_token" } (invalid)

POST /api/decks/admin/auth/logout
  200 → {} + Clear-Cookie
```

---

## 10. Magic Link Email

Sent via Resend. HTML email:

```
Subject: Your access to [Deck Title]

[First name if available / Hi there],

Click below to view "[Deck Title]":

[Button: Open Deck]

This link expires in 24 hours and can only be used once.

— Deck Share
```

---

## 11. Environment Variables

```
DECKS_ADMIN_TOKEN          — Admin auth token (generate: openssl rand -base64 32)
DECKS_KV_URL              — Vercel KV URL
DECKS_KV_TOKEN            — Vercel KV token
RESEND_API_KEY            — Resend API key
EMAIL_FROM                — noreply@muralikrishnan.net
NEXT_PUBLIC_DECKS_URL     — https://muralikrishnan.net
ADMIN_COOKIE_SECRET       — HMAC secret (generate: openssl rand -base64 32)
```

---

## 12. Open Issues / TBD

- **File storage:** Vercel Blob (recommended) or /public folder for HTML uploads
- **HTML sandboxing:** iframe `sandbox` attribute — allow-scripts, allow-same-origin
- **Admin cookie validation:** implement as a shared utility, not inline
- **Deploy config:** `vercel.json` routing to proxy `/decks/*.html` through API
