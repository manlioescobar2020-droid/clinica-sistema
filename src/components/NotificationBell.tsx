"use client"

import { useState, useEffect } from "react"
import { getMyNotifications, markAllAsRead, markAsRead, getUnreadCount } from "@/lib/actions/notifications"

type Notification = {
  id: string
  title: string
  message: string
  read: boolean
  createdAt: Date
  type: string
}

export default function NotificationBell({
  initialCount,
  initialNotifications,
}: {
  initialCount: number
  initialNotifications: Notification[]
}) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [notifications, setNotifications] = useState(initialNotifications)

  // Polling cada 30 segundos + carga inmediata al montar
  useEffect(() => {
    async function refresh() {
      try {
        const [newCount, newNotifications] = await Promise.all([
          getUnreadCount(),
          getMyNotifications(),
        ])
        setCount(newCount)
        setNotifications(newNotifications)
      } catch {
        // session expirada u otro error: no romper la UI
      }
    }

    refresh()
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [])

  async function handleOpen() {
    setOpen(!open)
    if (!open) {
      try {
        const [newCount, newNotifications] = await Promise.all([
          getUnreadCount(),
          getMyNotifications(),
        ])
        setCount(newCount)
        setNotifications(newNotifications)
      } catch {
        // no romper la UI si falla el refresh
      }
    }
  }

  async function handleMarkAllRead() {
    await markAllAsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setCount(0)
  }

  async function handleMarkRead(id: string) {
    await markAsRead(id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    setCount((prev) => Math.max(0, prev - 1))
  }

  const typeIcons: Record<string, string> = {
    NEW_APPOINTMENT: "📅",
    CANCELLATION:    "❌",
    PAYMENT:         "💰",
    NO_SHOW:         "🚫",
    AGENDA_BLOCK:    "🔒",
    REFUND:          "↩️",
  }

  return (
    <div className="relative">

      {/* Campana */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <span className="text-xl">🔔</span>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-12 w-80 bg-white rounded-xl border border-gray-200 shadow-lg z-30 overflow-hidden">

            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Notificaciones</h3>
              {count > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  No tenés notificaciones
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.read && handleMarkRead(n.id)}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                      !n.read ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg mt-0.5">{typeIcons[n.type] ?? "🔔"}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${!n.read ? "text-gray-900" : "text-gray-600"}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                          {n.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(n.createdAt).toLocaleDateString("es-AR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      {!n.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}