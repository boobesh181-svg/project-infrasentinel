import { useEffect, useState } from "react";
import {
  acknowledgeNotification,
  disputeNotification,
  fetchNotifications
} from "../api/notifications";
import { Notification } from "../types/notification";
import StatusPill from "../components/StatusPill";

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadNotifications = async () => {
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch (err: any) {
      setError(err?.message ?? "Unable to load notifications.");
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  const handleResponse = async (notificationId: string, response: "ack" | "dispute") => {
    setIsLoading(true);
    setError(null);
    try {
      if (response === "ack") {
        await acknowledgeNotification(notificationId);
      } else {
        await disputeNotification(notificationId);
      }
      await loadNotifications();
    } catch (err: any) {
      setError(err?.message ?? "Unable to update notification.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate">Notifications</p>
        <h2 className="text-2xl font-semibold text-ink">Action Required</h2>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="rounded-xl border border-cloud bg-white/90 p-6 shadow-soft">
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div key={notification.id} className="rounded-lg border border-cloud p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{notification.entity_type}</p>
                  <p className="text-xs text-slate">Entry {notification.entity_id}</p>
                  <p className="text-xs text-slate">
                    Deadline {new Date(notification.response_deadline).toLocaleString()}
                  </p>
                </div>
                <StatusPill label={notification.response_type} />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => handleResponse(notification.id, "ack")}
                  disabled={isLoading || notification.response_type !== "NONE"}
                  className="rounded-md bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Acknowledge
                </button>
                <button
                  onClick={() => handleResponse(notification.id, "dispute")}
                  disabled={isLoading || notification.response_type !== "NONE"}
                  className="rounded-md border border-cloud px-4 py-2 text-xs font-semibold text-ink disabled:opacity-50"
                >
                  Dispute
                </button>
              </div>
            </div>
          ))}
          {notifications.length === 0 ? (
            <p className="text-sm text-slate">No notifications pending.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
