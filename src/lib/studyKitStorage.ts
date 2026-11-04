/**
 * Persistent Storage Engine using IndexedDB
 * Ensures that uploaded files, generated study kits, and spaced-repetition SM-2 review progress
 * are automatically saved locally and survive browser reloads, network disconnects, or crashes.
 */

import { openDB, IDBPDatabase } from 'idb';
import { LectureArtifact, Flashcard } from '@/types/lecture';

const DB_NAME = 'universal_study_kit_db';
const DB_VERSION = 2;
const STORE_KITS = 'study_kits';
const STORE_FLASHCARDS = 'flashcard_progress';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_KITS)) {
          const store = db.createObjectStore(STORE_KITS, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_FLASHCARDS)) {
          db.createObjectStore(STORE_FLASHCARDS, { keyPath: 'cardId' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Automatically persists a study kit into IndexedDB.
 */
export async function saveStudyKitToStorage(kit: LectureArtifact): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    await db.put(STORE_KITS, kit);
  } catch (err) {
    console.warn('[IndexedDB Storage] Failed to persist study kit:', err);
  }
}

/**
 * Retrieves all saved study kits from IndexedDB sorted from newest to oldest.
 */
export async function getAllSavedStudyKits(): Promise<LectureArtifact[]> {
  try {
    const db = await getDB();
    if (!db) return [];
    const all = await db.getAll(STORE_KITS);
    return all.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } catch (err) {
    console.warn('[IndexedDB Storage] Failed to load study kits:', err);
    return [];
  }
}

/**
 * Retrieves a single study kit by ID.
 */
export async function getStudyKitById(id: string): Promise<LectureArtifact | null> {
  try {
    const db = await getDB();
    if (!db) return null;
    return (await db.get(STORE_KITS, id)) || null;
  } catch {
    return null;
  }
}

/**
 * Renames a saved study kit.
 */
export async function renameStudyKit(id: string, newTitle: string): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    const existing = await db.get(STORE_KITS, id);
    if (existing) {
      existing.title = newTitle.trim();
      await db.put(STORE_KITS, existing);
    }
  } catch (err) {
    console.warn('[IndexedDB Storage] Failed to rename study kit:', err);
  }
}

/**
 * Deletes a study kit from IndexedDB.
 */
export async function deleteStudyKit(id: string): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    await db.delete(STORE_KITS, id);
  } catch (err) {
    console.warn('[IndexedDB Storage] Failed to delete study kit:', err);
  }
}

/**
 * Updates SM-2 spaced repetition progress for a flashcard and syncs with the study kit.
 */
export async function updateFlashcardProgress(
  kitId: string,
  cardId: string,
  updates: Partial<Flashcard>
): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    const kit = await db.get(STORE_KITS, kitId);
    if (kit && kit.flashcards) {
      kit.flashcards = kit.flashcards.map((card: Flashcard) =>
        card.id === cardId ? { ...card, ...updates } : card
      );
      await db.put(STORE_KITS, kit);
    }
    await db.put(STORE_FLASHCARDS, {
      cardId,
      kitId,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[IndexedDB Storage] Failed to update flashcard progress:', err);
  }
}
