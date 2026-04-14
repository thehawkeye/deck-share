import { v4 as uuidv4 } from "uuid";

export function generateMagicToken(): string {
  return uuidv4();
}

export function createRequestId(): string {
  return uuidv4();
}

export function createAdminSessionId(): string {
  return uuidv4();
}
