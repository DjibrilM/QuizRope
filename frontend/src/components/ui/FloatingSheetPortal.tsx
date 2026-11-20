import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";

interface PortalEntry {
  key: number;
  node: React.ReactNode;
}

interface PortalStore {
  update: (key: number, node: React.ReactNode) => void;
  unmount: (key: number) => void;
  subscribe: (listener: (entries: PortalEntry[]) => void) => () => void;
  getSnapshot: () => PortalEntry[];
}

const FloatingSheetPortalContext = createContext<PortalStore | null>(null);

let nextPortalKey = 1;

/**
 * Isolated overlay host so mounting/updating a sheet never re-renders the
 * surrounding navigation stack under FloatingSheetPortalProvider.
 */
function FloatingSheetOverlayHost({ store }: { store: PortalStore }) {
  const [entries, setEntries] = useState<PortalEntry[]>(() => store.getSnapshot());

  useEffect(() => {
    setEntries(store.getSnapshot());
    return store.subscribe(setEntries);
  }, [store]);

  if (entries.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {entries.map((entry) => (
        <React.Fragment key={entry.key}>{entry.node}</React.Fragment>
      ))}
    </View>
  );
}

/**
 * Root portal provider mounted above screen SafeAreaViews so detached
 * bottom sheets use pure StyleSheet.absoluteFill overlays without <Modal>.
 */
export function FloatingSheetPortalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const entriesRef = useRef<PortalEntry[]>([]);
  const listenersRef = useRef<Set<(entries: PortalEntry[]) => void>>(new Set());

  const notify = useCallback(() => {
    const snapshot = entriesRef.current;
    listenersRef.current.forEach((listener) => listener(snapshot));
  }, []);

  const update = useCallback(
    (key: number, node: React.ReactNode) => {
      const prev = entriesRef.current;
      const idx = prev.findIndex((e) => e.key === key);
      const next = [...prev];
      if (idx === -1) {
        next.push({ key, node });
      } else {
        next[idx] = { key, node };
      }
      entriesRef.current = next;
      notify();
    },
    [notify],
  );

  const unmount = useCallback(
    (key: number) => {
      const prev = entriesRef.current;
      if (!prev.some((e) => e.key === key)) return;
      entriesRef.current = prev.filter((e) => e.key !== key);
      notify();
    },
    [notify],
  );

  const subscribe = useCallback((listener: (entries: PortalEntry[]) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const getSnapshot = useCallback(() => entriesRef.current, []);

  const store = useMemo<PortalStore>(
    () => ({ update, unmount, subscribe, getSnapshot }),
    [getSnapshot, subscribe, unmount, update],
  );

  return (
    <FloatingSheetPortalContext.Provider value={store}>
      {children}
      <FloatingSheetOverlayHost store={store} />
    </FloatingSheetPortalContext.Provider>
  );
}

/**
 * Renders children into the root FloatingSheetPortalProvider overlay host when
 * mounted below one, falling back inline if rendered standalone.
 */
export function FloatingSheetPortal({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const portal = useContext(FloatingSheetPortalContext);
  const keyRef = useRef<number | null>(null);
  if (keyRef.current === null) {
    keyRef.current = nextPortalKey++;
  }
  const key = keyRef.current;

  useEffect(() => {
    if (!portal) return;
    if (active) {
      portal.update(key, children);
    } else {
      portal.unmount(key);
    }
  }, [active, children, key, portal]);

  useEffect(() => {
    return () => {
      portal?.unmount(key);
    };
  }, [key, portal]);

  if (!portal) {
    return active ? <>{children}</> : null;
  }
  return null;
}
