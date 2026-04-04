"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PendingNotification,
  SentNotification,
  detectPendingNotifications,
  getSentLog,
  addToSentLog,
} from "@/lib/notifications";
import { WorkOrder } from "@/lib/types";
import { generateId } from "@/lib/utils";

export function useNotifications(orders: WorkOrder[]) {
  const [sentLog, setSentLog] = useState<SentNotification[]>([]);
  const [pending, setPending] = useState<PendingNotification[]>([]);

  const refresh = useCallback(() => {
    const log = getSentLog();
    setSentLog(log);
    setPending(detectPendingNotifications(orders, log));
  }, [orders]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markSent = useCallback(
    (notification: PendingNotification, customMessage?: string) => {
      const entry: SentNotification = {
        id: generateId(),
        orderId: notification.order.id,
        clientName: notification.order.clientName,
        clientPhone: notification.order.clientPhone,
        type: notification.template.type,
        message: customMessage ?? notification.template.buildMessage(notification.order),
        sentAt: new Date().toISOString(),
      };
      addToSentLog(entry);
      refresh();
    },
    [refresh]
  );

  const unsentCount = pending.filter((p) => !p.alreadySent).length;

  return { pending, sentLog, markSent, unsentCount, refresh };
}
