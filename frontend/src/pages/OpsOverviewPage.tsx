import { useEffect, useState } from "react";
import Card from "../components/ui/Card";
import { fetchSites } from "../api/ops";
import { Link } from "react-router-dom";
import OperationsLayout from "../components/layout/OperationsLayout";

const OpsOverviewPage = () => {
  const [sites, setSites] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchSites();
        setSites(data.sites || {});
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  // realtime updates
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload.type === "verification_result") {
          // increment site count if unknown
          const siteId = payload.site_id || "unknown";
          setSites((prev) => ({ ...prev, [siteId]: (prev[siteId] || 0) + 0 }));
        }
      } catch (e) {
        // ignore
      }
    };

    const wsUrl = (import.meta.env.VITE_API_WS_URL || "ws://127.0.0.1:8000") + "/stream/ops";
    const ws = new WebSocket(wsUrl);
    ws.onmessage = onMessage;
    return () => ws.close();
  }, []);

  return (
    <OperationsLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Operations Command Center</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loading ? (
            <div>Loading sites…</div>
          ) : (
            Object.entries(sites).map(([siteId, count]) => (
              <Card key={siteId} title={`Site ${siteId}`} subtitle={`${count} queued events`}>
                <div className="mt-2">
                  <Link to={`/app/ops/site/${siteId}`} className="text-indigo-600 underline">
                    Open site
                  </Link>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </OperationsLayout>
  );
};

export default OpsOverviewPage;
