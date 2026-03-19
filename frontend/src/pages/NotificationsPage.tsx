import { useEffect, useState } from "react";
import {
  acknowledgeNotification,
  disputeNotification,
  fetchNotifications
} from "../api/notifications";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { Table, TableCell, TableRow } from "../components/ui/Table";
import { Notification } from "../types/notification";

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadNotifications = async () => {
    try {
      const response = await fetchNotifications();
      setNotifications(response);
    } catch (err: any) {
      setError(err?.message ?? "Unable to load notifications.");
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  const onAction = async (notificationId: string, action: "ack" | "dispute") => {
    setIsLoading(true);
    setError(null);
    try {
      if (action === "ack") {
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
    <div className="space-y-4">
      <Card title="Notifications" subtitle="Review deadlines and take action on pending alerts.">
        <Table headers={["Entry", "Message", "Deadline", "Status", "Actions"]}>
          {notifications.map((notification) => (
            <TableRow key={notification.id}>
              <TableCell>{notification.entity_id.slice(0, 8)}</TableCell>
              <TableCell className="font-medium text-slate-900">{notification.entity_type}</TableCell>
              <TableCell>{new Date(notification.response_deadline).toLocaleString()}</TableCell>
              <TableCell>
                <Badge label={notification.response_type} />
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={isLoading || notification.response_type !== "NONE"}
                    onClick={() => onAction(notification.id, "ack")}
                  >
                    Acknowledge
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isLoading || notification.response_type !== "NONE"}
                    onClick={() => onAction(notification.id, "dispute")}
                  >
                    Dispute
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}

          {notifications.length === 0 ? (
            <TableRow>
              <td colSpan={5} className="border-b border-slate-100 px-4 py-6 text-center text-slate-500">
                No notifications.
              </td>
            </TableRow>
          ) : null}
        </Table>
      </Card>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
};

export default NotificationsPage;
