import { useEffect, useState } from "react";
import { fetchProjects } from "../api/projects";
import { fetchNotifications } from "../api/notifications";
import { Project } from "../types/project";
import { Notification } from "../types/notification";

const DashboardPage = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [projectData, notificationData] = await Promise.all([
          fetchProjects(),
          fetchNotifications()
        ]);
        setProjects(projectData);
        setNotifications(notificationData);
      } catch (err: any) {
        setError(err?.message ?? "Unable to load dashboard.");
      }
    };
    void load();
  }, []);

  const pendingNotifications = notifications.filter(
    (notification) => notification.response_type === "NONE"
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate">Overview</p>
        <h2 className="text-2xl font-semibold text-ink">Compliance Dashboard</h2>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="rounded-xl border border-cloud bg-white/90 p-5 shadow-soft">
          <p className="text-xs uppercase tracking-[0.2em] text-slate">Projects</p>
          <p className="mt-3 text-2xl font-semibold text-ink">{projects.length}</p>
        </div>
        <div className="rounded-xl border border-cloud bg-white/90 p-5 shadow-soft">
          <p className="text-xs uppercase tracking-[0.2em] text-slate">Pending Notifications</p>
          <p className="mt-3 text-2xl font-semibold text-ink">{pendingNotifications.length}</p>
        </div>
        <div className="rounded-xl border border-cloud bg-white/90 p-5 shadow-soft">
          <p className="text-xs uppercase tracking-[0.2em] text-slate">Pending Verifications</p>
          <p className="mt-3 text-2xl font-semibold text-ink">{pendingNotifications.length}</p>
        </div>
        <div className="rounded-xl border border-cloud bg-white/90 p-5 shadow-soft">
          <p className="text-xs uppercase tracking-[0.2em] text-slate">Recent Activity</p>
          <p className="mt-3 text-sm text-slate">Latest notifications loaded</p>
        </div>
      </div>

      <div className="rounded-xl border border-cloud bg-white/90 p-6 shadow-soft">
        <p className="text-sm font-semibold text-ink">Recent Notifications</p>
        <div className="mt-4 space-y-3">
          {notifications.slice(0, 4).map((notification) => (
            <div key={notification.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">{notification.entity_type}</p>
                <p className="text-xs text-slate">Due {new Date(notification.response_deadline).toLocaleString()}</p>
              </div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate">
                {notification.response_type}
              </p>
            </div>
          ))}
          {notifications.length === 0 ? (
            <p className="text-sm text-slate">No notifications available.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
