import { API_BASE_URL } from "@/lib/api"

function buildSocketUrl(pathname, query = {}) {
  const apiUrl = new URL(API_BASE_URL)
  const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:"
  const params = new URLSearchParams(query)
  const suffix = params.toString()
  return `${protocol}//${apiUrl.host}${pathname}${suffix ? `?${suffix}` : ""}`
}

class RealtimeClient {
  constructor() {
    this.socket = null
    this.accessToken = ""
    this.activeRole = "cliente"
    this.subscribersByEvent = new Map()
    this.anySubscribers = new Set()
    this.reconnectAttempts = 0
    this.reconnectTimer = null
    this.pingTimer = null
    this.destroyed = false
  }

  connect({ accessToken, activeRole }) {
    this.destroyed = false
    const tokenChanged = this.accessToken && this.accessToken !== accessToken
    this.accessToken = accessToken || ""
    this.activeRole = activeRole || "cliente"

    if (!this.accessToken) {
      this.disconnect()
      return
    }

    if (tokenChanged) {
      this._reconnectNow()
      return
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.switchRole(this.activeRole)
      return
    }

    if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
      return
    }

    this._openSocket()
  }

  disconnect() {
    this.destroyed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this._stopPing()
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }

  switchRole(role) {
    this.activeRole = role || "cliente"
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "switch_role", role: this.activeRole }))
    }
  }

  subscribe(eventType, handler) {
    if (eventType === "*") {
      this.anySubscribers.add(handler)
      return () => {
        this.anySubscribers.delete(handler)
      }
    }

    if (!this.subscribersByEvent.has(eventType)) {
      this.subscribersByEvent.set(eventType, new Set())
    }
    const set = this.subscribersByEvent.get(eventType)
    set.add(handler)
    return () => {
      set.delete(handler)
      if (set.size === 0) {
        this.subscribersByEvent.delete(eventType)
      }
    }
  }

  _openSocket() {
    const url = buildSocketUrl("/api/ws/notifications/", {
      access_token: this.accessToken,
      active_role: this.activeRole,
    })

    this.socket = new WebSocket(url)

    this.socket.onopen = () => {
      this.reconnectAttempts = 0
      this._startPing()
    }

    this.socket.onmessage = (event) => {
      this._handleMessage(event.data)
    }

    this.socket.onclose = () => {
      this._stopPing()
      this.socket = null
      if (!this.destroyed && this.accessToken) {
        this._scheduleReconnect()
      }
    }
  }

  _reconnectNow() {
    if (this.socket) {
      this.socket.close()
    } else {
      this._openSocket()
    }
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) {
      return
    }
    const delay = Math.min(30000, 1000 * (2 ** this.reconnectAttempts))
    this.reconnectAttempts += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this._openSocket()
    }, delay)
  }

  _startPing() {
    this._stopPing()
    this.pingTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "ping" }))
      }
    }, 25000)
  }

  _stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  _handleMessage(rawData) {
    let message
    try {
      message = JSON.parse(rawData)
    } catch {
      return
    }

    const eventType = message.event_type
    if (!eventType) {
      return
    }

    const payload = message.payload || {}
    const byEvent = this.subscribersByEvent.get(eventType)
    byEvent?.forEach((handler) => handler(payload, message))

    this.anySubscribers.forEach((handler) => handler(payload, message))
  }
}

export const realtimeClient = new RealtimeClient()
