import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Card from "../components/ui/Card";
import { apiClient } from "../api/client";
import OperationsLayout from "../components/layout/OperationsLayout";
import { useOpsSocket } from "../hooks/useOpsSocket";

const SitePage = () => {
  const { siteId } = useParams();
  const [queue, setQueue] = useState<any[]>([]);
  const [filterPlate, setFilterPlate] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const params: any = {};
        if (filterPlate) params.vehicle_plate = filterPlate;
        const resp = await apiClient.get(`/ops/site/${siteId}/queue`, { params });
        setQueue(resp.data.items || []);
      } catch (err) {
        console.error(err);
      }
    };
    void load();
  }, [siteId]);

  // use a robust socket hook to receive ops events and trigger reloads
  useOpsSocket((payload) => {
    try {
      if (!siteId) return;
      if (payload.site_id && String(payload.site_id) === String(siteId)) {
        if (payload.type === "verification_result" || payload.type === "operator_action") {
          void apiClient.get(`/ops/site/${siteId}/queue`, { params: { vehicle_plate: filterPlate } }).then((resp) => setQueue(resp.data.items || [])).catch(() => {});
        }
      }
    } catch (e) {}
  });

  useEffect(() => {
    // reload when filter changes
    const t = setTimeout(() => {
      void apiClient.get(`/ops/site/${siteId}/queue`, { params: { vehicle_plate: filterPlate } }).then((resp) => setQueue(resp.data.items || [])).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [filterPlate, siteId]);

  return (
    <OperationsLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Site {siteId}</h2>
        <div className="flex items-center gap-3">
          <input className="rounded border px-3 py-2" placeholder="Filter by plate" value={filterPlate} onChange={(e) => setFilterPlate(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-4">
          {queue.length === 0 ? (
            <Card>No queued deliveries</Card>
          ) : (
            queue.map((item) => (
              <Card key={item.id} title={item.vehicle_plate || "Unknown vehicle"} subtitle={item.supplier}>
                <div className="mt-2">
                  <Link to={`/app/verify/${item.id}`} className="text-indigo-600 underline">
                    Open verification
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

export default SitePage;
