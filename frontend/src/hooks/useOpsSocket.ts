import { useEffect, useRef } from "react";

type OnPayload = (payload: any) => void;

export function useOpsSocket(onPayload: OnPayload) {
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const reconnectTimer = useRef<number | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const onPayloadRef = useRef(onPayload);

  useEffect(() => {
    onPayloadRef.current = onPayload;
  }, [onPayload]);

  useEffect(() => {
    const url = (import.meta.env.VITE_API_WS_URL || "ws://127.0.0.1:8000") + "/ops/stream/ops";

    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        attemptsRef.current = 0;
        console.debug("useOpsSocket: connected");
      };

      ws.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          const id = payload.id || payload.uid || JSON.stringify([payload.type || "", payload.site_id || "", payload.created_at || Date.now()]);
          if (seen.current.has(id)) return;
          seen.current.add(id);
          // keep Set bounded
          if (seen.current.size > 1000) {
            // drop half
            const it = seen.current.values();
            for (let i = 0; i < 500; i++) {
              const v = it.next().value;
              if (!v) break;
              seen.current.delete(v);
            }
          }
          onPayloadRef.current(payload);
        } catch (e) {
          // ignore non-json messages
        }
      };

      ws.onclose = () => {
        console.debug("useOpsSocket: closed, scheduling reconnect");
        scheduleReconnect();
      };

      ws.onerror = (e) => {
        console.error("useOpsSocket error", e);
        try {
          ws.close();
        } catch (e) {}
      };
    };

    const scheduleReconnect = () => {
      if (reconnectTimer.current) return;
      attemptsRef.current += 1;
      const backoff = Math.min(30000, 1000 * Math.pow(1.5, attemptsRef.current));
      reconnectTimer.current = window.setTimeout(() => {
        reconnectTimer.current = null;
        connect();
      }, backoff);
    };

    connect();

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      try {
        wsRef.current?.close();
      } catch (e) {}
    };
  }, []);

  return wsRef;
}
