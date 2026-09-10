// Offline queue for kiosk punches. A punch that can't reach the server (bad
// wifi) is stored in IndexedDB and replayed later; the server dedupes on
// client_uuid so a replay is a no-op if the original actually landed.

export type QueuedPunch = {
  client_uuid: string;
  staff_id: number;
  staff_name: string;
  pin: string; // on-device only, on a physically controlled tablet; cleared on drain
  photo: string | null;
  queued_at: string;
};

const DB = "rc-attendance-kiosk";
const STORE = "punch-queue";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "client_uuid" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

export async function enqueue(p: QueuedPunch): Promise<void> {
  await tx("readwrite", (s) => s.put(p));
}

export async function list(): Promise<QueuedPunch[]> {
  return tx<QueuedPunch[]>("readonly", (s) => s.getAll());
}

export async function remove(clientUuid: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(clientUuid));
}

export async function count(): Promise<number> {
  return tx<number>("readonly", (s) => s.count());
}

/** Replay every queued punch. Removes ones the server accepted (or that it
 *  reports as already-applied). Leaves ones that fail again for the next run. */
export async function drain(): Promise<{ sent: number; left: number }> {
  const items = await list();
  let sent = 0;
  for (const p of items) {
    try {
      const res = await fetch("/api/kiosk/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: p.staff_id,
          pin: p.pin,
          photo: p.photo,
          client_uuid: p.client_uuid,
        }),
      });
      // 2xx = accepted or idempotent replay. 401/423 = the PIN was wrong / locked
      // when queued — nothing we can do now, drop it so it doesn't loop forever.
      if (res.ok || res.status === 401 || res.status === 423) {
        await remove(p.client_uuid);
        if (res.ok) sent++;
      }
    } catch {
      // still offline — stop, try again next tick
      break;
    }
  }
  return { sent, left: await count() };
}
