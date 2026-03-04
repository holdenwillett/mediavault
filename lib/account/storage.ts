import type { AccountProfile, CollectionEntry, CollectionStatus } from "@/lib/account/types";
import type { MediaSearchItem } from "@/lib/media/types";

type StoredAccount = AccountProfile & {
  passwordHash: string;
};

const ACCOUNTS_KEY = "mediavault_accounts_v1";
const SESSION_KEY = "mediavault_session_v1";
const COLLECTION_KEY = "mediavault_collection_v2";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function toAccountId(name: string): string {
  return normalizeName(name).replace(/\s+/g, "-");
}

function hashPassword(password: string): string {
  // Lightweight client-side hash to avoid storing plain text passwords.
  // This is not equivalent to server-side password security.
  let h1 = 0xdeadbeef ^ password.length;
  let h2 = 0x41c6ce57 ^ password.length;
  for (let i = 0; i < password.length; i += 1) {
    const ch = password.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0).toString(16).padStart(8, "0")}`;
}

function getAccounts(): StoredAccount[] {
  if (!canUseStorage()) return [];
  const raw = window.localStorage.getItem(ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredAccount[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setAccounts(accounts: StoredAccount[]): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function getSessionUserId(): string | null {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(SESSION_KEY);
}

function setSessionUserId(userId: string | null): void {
  if (!canUseStorage()) return;
  if (!userId) {
    window.localStorage.removeItem(SESSION_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_KEY, userId);
}

export function getProfile(): AccountProfile | null {
  const userId = getSessionUserId();
  if (!userId) return null;
  const account = getAccounts().find((a) => a.id === userId);
  if (!account) return null;
  return { id: account.id, name: account.name, createdAt: account.createdAt };
}

export function createAccount(name: string, password: string): { profile?: AccountProfile; error?: string } {
  if (!canUseStorage()) return { error: "Storage unavailable" };
  const trimmedName = name.trim();
  if (trimmedName.length < 2) return { error: "Name must be at least 2 characters" };
  if (password.length < 6) return { error: "Password must be at least 6 characters" };

  const accounts = getAccounts();
  const normalized = normalizeName(trimmedName);
  const exists = accounts.some((a) => normalizeName(a.name) === normalized);
  if (exists) return { error: "Account already exists. Sign in instead." };

  const profile: AccountProfile = {
    id: toAccountId(trimmedName),
    name: trimmedName,
    createdAt: new Date().toISOString(),
  };

  const next: StoredAccount = {
    ...profile,
    passwordHash: hashPassword(password),
  };

  accounts.push(next);
  setAccounts(accounts);
  setSessionUserId(profile.id);
  return { profile };
}

export function signIn(name: string, password: string): { profile?: AccountProfile; error?: string } {
  if (!canUseStorage()) return { error: "Storage unavailable" };
  const normalized = normalizeName(name);
  const account = getAccounts().find((a) => normalizeName(a.name) === normalized);
  if (!account) return { error: "Account not found" };
  if (account.passwordHash !== hashPassword(password)) return { error: "Incorrect password" };
  setSessionUserId(account.id);
  return { profile: { id: account.id, name: account.name, createdAt: account.createdAt } };
}

export function clearProfile(): void {
  setSessionUserId(null);
}

function getAllCollection(): CollectionEntry[] {
  if (!canUseStorage()) return [];
  const raw = window.localStorage.getItem(COLLECTION_KEY);
  if (!raw) return [];
  try {
    const items = JSON.parse(raw) as CollectionEntry[];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function setAllCollection(items: CollectionEntry[]): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(COLLECTION_KEY, JSON.stringify(items));
}

export function getCollection(): CollectionEntry[] {
  const userId = getSessionUserId();
  if (!userId) return [];
  return getAllCollection().filter((item) => item.userId === userId);
}

export function getCollectionItem(mediaType: string, externalId: string | number): CollectionEntry | null {
  const key = `${mediaType}:${String(externalId)}`;
  return getCollection().find((item) => item.id === key) ?? null;
}

export function upsertCollectionItem(
  media: Pick<MediaSearchItem, "mediaType" | "externalId" | "source" | "title" | "posterUrl" | "rating">,
  status: CollectionStatus
): CollectionEntry {
  const user = getProfile();
  if (!user) {
    throw new Error("You must be signed in to update collection.");
  }

  const allItems = getAllCollection();
  const id = `${media.mediaType}:${String(media.externalId)}`;
  const now = new Date().toISOString();
  const existing = allItems.find((item) => item.id === id && item.userId === user.id);

  const next: CollectionEntry = {
    id,
    userId: user.id,
    mediaType: media.mediaType,
    externalId: media.externalId,
    source: media.source,
    title: media.title,
    posterUrl: media.posterUrl ?? null,
    rating: media.rating,
    status,
    addedAt: existing?.addedAt ?? now,
    updatedAt: now,
  };

  const filtered = allItems.filter((item) => !(item.id === id && item.userId === user.id));
  filtered.push(next);
  setAllCollection(filtered);
  return next;
}

export function removeCollectionItem(mediaType: string, externalId: string | number): void {
  const user = getProfile();
  if (!user) return;
  const id = `${mediaType}:${String(externalId)}`;
  const next = getAllCollection().filter((item) => !(item.id === id && item.userId === user.id));
  setAllCollection(next);
}
