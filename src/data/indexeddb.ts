// indexeddb.ts
import { openDB } from "idb";

const DB_NAME = "epub-reader-db";
const STORE_NAME = "epub-files";

export async function getDb() {
  return await openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "name" });
      }
    },
  });
}

export async function addEpub(file: File) {
  const db = await getDb();
  const arrayBuffer = await file.arrayBuffer();
  await db.put(STORE_NAME, { name: file.name, data: arrayBuffer });
}

export async function getEpub(fileName: string) {
  const db = await getDb();
  return await db.get(STORE_NAME, fileName);
}

export async function deleteEpub(fileName: string) {
  const db = await getDb();
  await db.delete(STORE_NAME, fileName);
}

export async function getAllEpubs() {
  const db = await getDb();
  return await db.getAll(STORE_NAME);
}
