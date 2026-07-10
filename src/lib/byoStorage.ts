/**
 * Bring-your-own storage config (docs/ROADMAP.md Phase 3): the learner's own
 * database and Cloudinary credentials. Browser-only, exactly like the
 * OpenRouter key — the platform never stores anyone's infrastructure keys.
 * The sync engine that consumes these lands with Phase 2/3; the inputs exist
 * now so learners can set up early and nothing about the contract changes.
 */

export interface ByoStorageConfig {
  /** e.g. libsql://... + token, or a Neon/Postgres URL — the learner's own DB */
  dbUrl: string;
  dbAuthToken: string;
  /** cloudinary://key:secret@cloud-name or an unsigned upload preset URL */
  cloudinaryUrl: string;
}

const STORAGE_KEY = 'synapse-byo-storage';

export function getByoStorage(): ByoStorageConfig {
  const empty: ByoStorageConfig = { dbUrl: '', dbAuthToken: '', cloudinaryUrl: '' };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<ByoStorageConfig>;
    return {
      dbUrl: parsed.dbUrl || '',
      dbAuthToken: parsed.dbAuthToken || '',
      cloudinaryUrl: parsed.cloudinaryUrl || '',
    };
  } catch {
    return empty;
  }
}

export function setByoStorage(config: ByoStorageConfig): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed: ByoStorageConfig = {
      dbUrl: config.dbUrl.trim(),
      dbAuthToken: config.dbAuthToken.trim(),
      cloudinaryUrl: config.cloudinaryUrl.trim(),
    };
    if (!trimmed.dbUrl && !trimmed.dbAuthToken && !trimmed.cloudinaryUrl) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    }
  } catch {
    // storage unavailable — config just won't persist
  }
}
