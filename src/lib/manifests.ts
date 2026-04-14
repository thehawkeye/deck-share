import { kvDelete, kvGetJson, kvKeysByPattern, kvKeys, kvSetJson } from "@/lib/kv";
import { createRequestId, generateMagicToken } from "@/lib/token";
import { sendMagicLinkEmail } from "@/lib/email";

const DEFAULT_OWNER_EMAIL = "muralikrishnan@gmail.com";

export type DeckMode = "locked" | "request" | "open";
export type EmailStatus = "pending" | "active" | "revoked";
export type RequestStatus = "pending" | "approved" | "rejected";

export interface DeckEmail {
  email: string;
  addedAt: string;
  addedBy: string;
  status: EmailStatus;
}

export interface DeckManifest {
  title: string;
  mode: DeckMode;
  sharingEnabled: boolean;
  emails: DeckEmail[];
  emailDomains: string[];
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeckAccessToken {
  email: string;
  filename: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
}

export interface DeckShareRequest {
  id: string;
  fromEmail: string;
  requestedEmail: string;
  status: RequestStatus;
  createdAt: string;
}

export interface DeckSummary {
  filename: string;
  manifest: DeckManifest;
}

export async function getManifest(filename: string): Promise<DeckManifest | null> {
  return kvGetJson<DeckManifest>(kvKeys.manifest(filename));
}

export async function saveManifest(filename: string, manifest: DeckManifest): Promise<void> {
  await kvSetJson(kvKeys.manifest(filename), {
    ...manifest,
    updatedAt: new Date().toISOString(),
  });
}

export async function ensureManifest(filename: string, title?: string): Promise<DeckManifest> {
  const existing = await getManifest(filename);
  if (existing) {
    if (!hasEmail(existing, DEFAULT_OWNER_EMAIL)) {
      existing.emails.push({
        email: DEFAULT_OWNER_EMAIL,
        addedAt: new Date().toISOString(),
        addedBy: DEFAULT_OWNER_EMAIL,
        status: "active",
      });
      await saveManifest(filename, existing);
    }
    return existing;
  }

  const now = new Date().toISOString();
  const manifest: DeckManifest = {
    title: title ?? humanizeFilename(filename),
    mode: "locked",
    sharingEnabled: false,
    emails: [
      {
        email: DEFAULT_OWNER_EMAIL,
        addedAt: now,
        addedBy: DEFAULT_OWNER_EMAIL,
        status: "active",
      },
    ],
    emailDomains: [],
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await kvSetJson(kvKeys.manifest(filename), manifest);
  return manifest;
}

export async function deleteManifest(filename: string): Promise<void> {
  await kvDelete(kvKeys.manifest(filename));
}

export async function listDecks(): Promise<DeckSummary[]> {
  const keys = await kvKeysByPattern(kvKeys.manifestPattern());
  const decks: DeckSummary[] = [];

  await Promise.all(
    keys.map(async (key) => {
      const manifest = await kvGetJson<DeckManifest>(key);
      if (!manifest) {
        return;
      }
      const filename = key.replace(/^deck:/, "").replace(/:manifest$/, "");
      decks.push({ filename, manifest });
    }),
  );

  decks.sort((a, b) => b.manifest.updatedAt.localeCompare(a.manifest.updatedAt));
  return decks;
}

export async function addEmailsToManifest(input: {
  filename: string;
  emails: string[];
  addedBy: string;
}): Promise<{ added: string[]; alreadyExists: string[]; manifest: DeckManifest }> {
  const manifest = await ensureManifest(input.filename);
  const added: string[] = [];
  const alreadyExists: string[] = [];

  for (const rawEmail of input.emails) {
    const email = normalizeEmail(rawEmail);
    if (!email) continue;

    const existing = manifest.emails.find((entry) => entry.email === email);
    if (existing && existing.status !== "revoked") {
      alreadyExists.push(email);
      continue;
    }

    if (existing && existing.status === "revoked") {
      existing.status = "pending";
      existing.addedAt = new Date().toISOString();
      existing.addedBy = input.addedBy;
      added.push(email);
      continue;
    }

    manifest.emails.push({
      email,
      status: "pending",
      addedAt: new Date().toISOString(),
      addedBy: input.addedBy,
    });
    added.push(email);
  }

  await saveManifest(input.filename, manifest);
  return { added, alreadyExists, manifest };
}

export async function removeEmailsFromManifest(input: {
  filename: string;
  emails: string[];
}): Promise<{ removed: string[]; manifest: DeckManifest }> {
  const manifest = await ensureManifest(input.filename);
  const toRemove = new Set(input.emails.map(normalizeEmail).filter(Boolean));
  const removed: string[] = [];

  manifest.emails = manifest.emails.filter((entry) => {
    if (!toRemove.has(entry.email)) {
      return true;
    }
    removed.push(entry.email);
    return false;
  });

  await saveManifest(input.filename, manifest);
  return { removed, manifest };
}

export async function setEmailStatus(input: {
  filename: string;
  email: string;
  status: EmailStatus;
}): Promise<DeckManifest> {
  const manifest = await ensureManifest(input.filename);
  const email = normalizeEmail(input.email);
  const entry = manifest.emails.find((candidate) => candidate.email === email);
  if (!entry) {
    throw new Error("email_not_found");
  }
  entry.status = input.status;
  await saveManifest(input.filename, manifest);
  return manifest;
}

export async function issueMagicLink(input: {
  filename: string;
  email: string;
}): Promise<{ token: string; manifest: DeckManifest }> {
  const manifest = await ensureManifest(input.filename);
  const email = normalizeEmail(input.email);
  const entry = manifest.emails.find((candidate) => candidate.email === email);

  if (!entry || entry.status === "revoked") {
    throw new Error("email_not_allowed");
  }

  const now = Date.now();
  const tokenId = generateMagicToken();
  const payload: DeckAccessToken = {
    email,
    filename: input.filename,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    used: false,
  };

  await kvSetJson(kvKeys.token(tokenId), payload);
  await sendMagicLinkEmail({
    to: email,
    token: tokenId,
    filename: input.filename,
    title: manifest.title,
  });

  return { token: tokenId, manifest };
}

export async function getAccessToken(token: string): Promise<DeckAccessToken | null> {
  return kvGetJson<DeckAccessToken>(kvKeys.token(token));
}

export async function consumeAccessToken(token: string): Promise<void> {
  await kvDelete(kvKeys.token(token));
}

export async function markEmailActive(filename: string, email: string): Promise<void> {
  const manifest = await ensureManifest(filename);
  const normalized = normalizeEmail(email);
  const entry = manifest.emails.find((candidate) => candidate.email === normalized);
  if (entry) {
    entry.status = "active";
    await saveManifest(filename, manifest);
  }
}

export async function listRequests(filename: string): Promise<DeckShareRequest[]> {
  const keys = await kvKeysByPattern(kvKeys.requestPattern(filename));
  const requests: DeckShareRequest[] = [];

  await Promise.all(
    keys.map(async (key) => {
      const request = await kvGetJson<DeckShareRequest>(key);
      if (!request) return;
      requests.push(request);
    }),
  );

  requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return requests;
}

export async function createRequest(input: {
  filename: string;
  fromEmail: string;
  requestedEmail: string;
}): Promise<DeckShareRequest> {
  const id = createRequestId();
  const request: DeckShareRequest = {
    id,
    fromEmail: normalizeEmail(input.fromEmail),
    requestedEmail: normalizeEmail(input.requestedEmail),
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  await kvSetJson(kvKeys.request(input.filename, id), request);
  return request;
}

export async function getRequest(filename: string, requestId: string): Promise<DeckShareRequest | null> {
  return kvGetJson<DeckShareRequest>(kvKeys.request(filename, requestId));
}

export async function updateRequestStatus(input: {
  filename: string;
  requestId: string;
  status: RequestStatus;
}): Promise<DeckShareRequest> {
  const request = await getRequest(input.filename, input.requestId);
  if (!request) {
    throw new Error("request_not_found");
  }
  request.status = input.status;
  await kvSetJson(kvKeys.request(input.filename, input.requestId), request);
  return request;
}

export function isDeckExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

export function normalizeEmail(value: string): string {
  return value.toLowerCase().trim();
}

export function isEmailAllowed(manifest: DeckManifest, email: string): boolean {
  const normalized = normalizeEmail(email);
  const exact = manifest.emails.find((entry) => entry.email === normalized && entry.status !== "revoked");
  if (exact) return true;

  const domain = normalized.split("@")[1];
  if (!domain) return false;

  return manifest.emailDomains.some((candidate) => candidate.toLowerCase() === domain);
}

function hasEmail(manifest: DeckManifest, email: string): boolean {
  const normalized = normalizeEmail(email);
  return manifest.emails.some((entry) => entry.email === normalized);
}

function humanizeFilename(filename: string): string {
  return filename
    .replace(/\.html?$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
