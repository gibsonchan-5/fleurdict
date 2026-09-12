/**
 * FleurDict - Secret storage
 *
 * API keys are kept in the system keychain through Obsidian's official
 * SecretStorage API (`app.secretStorage`, available since Obsidian 1.11.4)
 * instead of being written to `data.json` as plain text.
 *
 * Everything here degrades gracefully: if SecretStorage is missing (older
 * Obsidian) the caller keeps the plain-text value, so no key is ever lost.
 */

import type { App } from 'obsidian';
import { debugLog } from './debug';

/**
 * Settings fields that must never be persisted to `data.json` in plain text.
 */
export const SECRET_FIELDS = ['aiApiKey', 'eudicToken'] as const;

export type SecretField = typeof SECRET_FIELDS[number];

/**
 * Secret IDs. Obsidian requires lowercase alphanumeric characters with
 * optional dashes, and prefixes them with the app namespace internally.
 */
export const SECRET_IDS: Record<SecretField, string> = {
  aiApiKey: 'fleurdict-ai-api-key',
  eudicToken: 'fleurdict-eudic-token',
};

interface SecretStorageLike {
  getSecret?(id: string): string | null | Promise<string | null>;
  setSecret?(id: string, secret: string): void | Promise<void>;
}

/**
 * Returns the SecretStorage object only when it looks usable, so a partially
 * featured or future implementation cannot break the plugin.
 */
function storageOf(app: App | null | undefined): SecretStorageLike | null {
  const storage = (app as unknown as { secretStorage?: SecretStorageLike } | null | undefined)
    ?.secretStorage;
  if (!storage) return null;
  if (typeof storage.getSecret !== 'function') return null;
  if (typeof storage.setSecret !== 'function') return null;
  return storage;
}

/** Whether secrets can be stored in the system keychain on this build. */
export function secretStorageAvailable(app: App | null | undefined): boolean {
  return storageOf(app) !== null;
}

/** Reads a secret from the keychain. Returns '' when unset or unavailable. */
export async function readSecret(app: App | null | undefined, id: string): Promise<string> {
  const storage = storageOf(app);
  if (!storage?.getSecret) return '';
  try {
    // The API is synchronous today; Promise.resolve keeps this future-proof.
    const value = await Promise.resolve(storage.getSecret(id));
    return typeof value === 'string' ? value : '';
  } catch (error) {
    debugLog('[FleurDict] readSecret failed:', error);
    return '';
  }
}

/**
 * Writes a secret to the keychain and verifies it by reading it back.
 * Returns false when the write could not be confirmed.
 */
export async function writeSecret(
  app: App | null | undefined,
  id: string,
  value: string,
): Promise<boolean> {
  const storage = storageOf(app);
  if (!storage?.setSecret) return false;
  try {
    await Promise.resolve(storage.setSecret(id, value));
    const readBack = await readSecret(app, id);
    return readBack === value;
  } catch (error) {
    debugLog('[FleurDict] writeSecret failed:', error);
    return false;
  }
}

export interface HydrateSecretsResult {
  /** Whether the system keychain is usable. */
  available: boolean;
  /** Fields that were still plain text and got moved into the keychain. */
  migrated: SecretField[];
  /** Fields that were restored from the keychain. */
  hydrated: SecretField[];
}

/**
 * Reconciles secrets across the keychain, the in-memory settings object and
 * the legacy plain-text copies found on disk.
 *
 * The keychain always wins; a plain-text value is only taken as the source
 * when the keychain has nothing for that field yet, in which case it is
 * promoted into the keychain.
 *
 * @param settings In-memory settings object, mutated in place.
 * @param legacy   Raw persisted data, used to recover pre-nesting flat copies.
 */
export async function hydrateSecrets(
  app: App | null | undefined,
  settings: Record<string, unknown>,
  legacy?: Record<string, unknown> | null,
): Promise<HydrateSecretsResult> {
  const available = secretStorageAvailable(app);
  const migrated: SecretField[] = [];
  const hydrated: SecretField[] = [];

  for (const field of SECRET_FIELDS) {
    const id = SECRET_IDS[field];

    if (available) {
      const stored = await readSecret(app, id);
      if (stored) {
        settings[field] = stored;
        hydrated.push(field);
        continue;
      }
    }

    const inSettings = typeof settings[field] === 'string' ? (settings[field] as string) : '';
    const flatCopy = typeof legacy?.[field] === 'string' ? (legacy[field] as string) : '';
    const plain = inSettings || flatCopy;
    if (!plain) continue;

    settings[field] = plain;
    if (!available) continue;

    const ok = await writeSecret(app, id, plain);
    if (ok) migrated.push(field);
  }

  return { available, migrated, hydrated };
}

/**
 * Builds the object that will actually be written to `data.json`.
 *
 * Every secret is pushed to the keychain first and is only blanked from the
 * returned copy once the keychain confirms it holds the value. If the
 * keychain is unavailable the plain-text value is kept, so downgrading
 * Obsidian never loses a key.
 */
export async function scrubSecretsForPersistence(
  app: App | null | undefined,
  settings: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const persisted: Record<string, unknown> = { ...settings };

  for (const field of SECRET_FIELDS) {
    const value = typeof settings[field] === 'string' ? (settings[field] as string) : '';
    if (!value) {
      persisted[field] = '';
      continue;
    }
    const stored = await writeSecret(app, SECRET_IDS[field], value);
    persisted[field] = stored ? '' : value;
    if (!stored) {
      debugLog(`[FleurDict] ${field} kept in data.json (keychain unavailable)`);
    }
  }

  return persisted;
}
