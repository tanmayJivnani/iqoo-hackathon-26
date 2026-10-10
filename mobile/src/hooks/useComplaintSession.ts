import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

// Store metadata separately from evidence so background saves never serialize image base64.
export function useComplaintSession<T>(snapshot: T, restore: (saved: T) => Promise<void>, storageKey = 'complaint-session') {
  const latest = useRef(snapshot);
  const restoreRef = useRef(restore);
  const [ready, setReady] = useState(false);
  const copied = useRef(new Map<string, string>());

  const persist = () => {
    try {
      const directory = new Directory(Paths.document, storageKey);
      directory.create({ intermediates: true, idempotent: true });
      const retain = (value: unknown): unknown => {
        if (typeof value === 'string' && (value.startsWith('file://') || value.startsWith('content://'))) {
          if (value.startsWith(directory.uri)) return value;
          const existing = copied.current.get(value);
          if (existing) return existing;
          const source = new File(value);
          const target = new File(directory, `${Date.now()}-${Math.random().toString(36).slice(2)}-${source.name}`);
          source.copy(target); copied.current.set(value, target.uri);
          return target.uri;
        }
        if (Array.isArray(value)) return value.map(retain);
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'base64').map(([key, item]) => [key, retain(item)]));
        return value;
      };
      const file = new File(directory, 'state.json');
      if (!file.exists) file.create();
      file.write(JSON.stringify({ version: 1, state: retain(latest.current) }));
    } catch (error) { console.warn('Could not save complaint progress:', error instanceof Error ? error.message : 'Storage unavailable'); }
  };
  const persistRef = useRef(persist);

  useEffect(() => {
    latest.current = snapshot;
    restoreRef.current = restore;
    persistRef.current = persist;
  });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const file = new File(Paths.document, storageKey, 'state.json');
        if (file.exists) {
          const saved = JSON.parse(await file.text());
          if (active && saved.version === 1 && saved.state) await restoreRef.current(saved.state as T);
        }
      } catch (error) { console.warn('Could not restore complaint progress:', error instanceof Error ? error.message : 'Invalid saved session'); }
      finally { if (active) setReady(true); }
    })();
    return () => { active = false; };
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    const timeout = setTimeout(() => persistRef.current(), 350);
    return () => clearTimeout(timeout);
  }, [snapshot, ready]);
  useEffect(() => {
    if (!ready) return;
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') persistRef.current(); });
    return () => subscription.remove();
  }, [ready]);
  return ready;
}
