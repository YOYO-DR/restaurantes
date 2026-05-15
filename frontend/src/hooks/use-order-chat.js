import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  buildOrderChatSocketUrl,
  getOrderChat,
  markOrderChatRead,
  sendOrderChatMessage,
} from "@/services/order-chat"
import { API_BASE_URL, getAccessToken } from "@/lib/api"

const IMAGE_CACHE_INDEX_KEY = "order-chat-image:index:v1"
const HOUR_IN_MS = 60 * 60 * 1000
const MOBILE_CACHE_PROFILE = {
  ttlMs: 12 * HOUR_IN_MS,
  maxEntries: 30,
  maxBytes: 8 * 1024 * 1024,
}
const DESKTOP_CACHE_PROFILE = {
  ttlMs: 24 * HOUR_IN_MS,
  maxEntries: 80,
  maxBytes: 32 * 1024 * 1024,
}

function isLikelyMobileDevice() {
  if (typeof window === "undefined") {
    return false
  }
  if (window.matchMedia?.("(max-width: 768px)")?.matches) {
    return true
  }
  if (window.matchMedia?.("(pointer: coarse)")?.matches) {
    return true
  }
  const userAgent = window.navigator?.userAgent || ""
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)
}

function getImageCacheProfile() {
  return isLikelyMobileDevice() ? MOBILE_CACHE_PROFILE : DESKTOP_CACHE_PROFILE
}

function canUseSessionStorage() {
  if (typeof window === "undefined") {
    return false
  }
  try {
    return Boolean(window.sessionStorage)
  } catch {
    return false
  }
}

function readCacheIndex() {
  if (!canUseSessionStorage()) {
    return {}
  }
  try {
    const raw = window.sessionStorage.getItem(IMAGE_CACHE_INDEX_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") {
      return {}
    }
    return parsed
  } catch {
    return {}
  }
}

function writeCacheIndex(index) {
  if (!canUseSessionStorage()) {
    return
  }
  try {
    window.sessionStorage.setItem(IMAGE_CACHE_INDEX_KEY, JSON.stringify(index))
  } catch {
    return
  }
}

function removeCacheEntry(cacheKey, index) {
  if (!canUseSessionStorage()) {
    return index
  }
  const nextIndex = { ...index }
  delete nextIndex[cacheKey]
  try {
    window.sessionStorage.removeItem(cacheKey)
  } catch {
    return nextIndex
  }
  return nextIndex
}

function pruneExpiredCacheEntries({ index, profile, now }) {
  let nextIndex = { ...index }
  Object.entries(index).forEach(([cacheKey, metadata]) => {
    if (cacheKey === IMAGE_CACHE_INDEX_KEY) {
      return
    }
    if (!metadata || typeof metadata !== "object") {
      nextIndex = removeCacheEntry(cacheKey, nextIndex)
      return
    }
    const lastAccessAt = Number(metadata.lastAccessAt || metadata.createdAt || 0)
    if (!lastAccessAt || now - lastAccessAt > profile.ttlMs) {
      nextIndex = removeCacheEntry(cacheKey, nextIndex)
      return
    }
    try {
      if (!window.sessionStorage.getItem(cacheKey)) {
        delete nextIndex[cacheKey]
      }
    } catch {
      delete nextIndex[cacheKey]
    }
  })
  return nextIndex
}

function getCachedImageData({ cacheKey, userCacheKey, profile }) {
  if (!canUseSessionStorage()) {
    return ""
  }
  const now = Date.now()
  const currentIndex = readCacheIndex()
  let nextIndex = pruneExpiredCacheEntries({ index: currentIndex, profile, now })
  const metadata = nextIndex[cacheKey]
  if (!metadata || metadata.userCacheKey !== userCacheKey) {
    writeCacheIndex(nextIndex)
    return ""
  }

  try {
    const cachedData = window.sessionStorage.getItem(cacheKey)
    if (!cachedData) {
      delete nextIndex[cacheKey]
      writeCacheIndex(nextIndex)
      return ""
    }
    nextIndex = {
      ...nextIndex,
      [cacheKey]: {
        ...metadata,
        lastAccessAt: now,
      },
    }
    writeCacheIndex(nextIndex)
    return cachedData
  } catch {
    return ""
  }
}

function estimateStringBytes(value) {
  if (!value) {
    return 0
  }
  return value.length * 2
}

function enforceUserCacheBudget({ index, profile, userCacheKey }) {
  let nextIndex = { ...index }
  const entries = Object.entries(nextIndex)
    .filter(([, metadata]) => metadata?.userCacheKey === userCacheKey)
    .map(([cacheKey, metadata]) => ({
      cacheKey,
      lastAccessAt: Number(metadata.lastAccessAt || metadata.createdAt || 0),
      sizeBytes: Number(metadata.sizeBytes || 0),
    }))
    .sort((a, b) => a.lastAccessAt - b.lastAccessAt)

  let entryCount = entries.length
  let totalBytes = entries.reduce((acc, entry) => acc + entry.sizeBytes, 0)

  entries.forEach((entry) => {
    const exceedsCount = entryCount > profile.maxEntries
    const exceedsSize = totalBytes > profile.maxBytes
    if (!exceedsCount && !exceedsSize) {
      return
    }
    nextIndex = removeCacheEntry(entry.cacheKey, nextIndex)
    entryCount -= 1
    totalBytes -= entry.sizeBytes
  })

  return nextIndex
}

function setCachedImageData({ cacheKey, userCacheKey, dataUrl, blobSize, profile }) {
  if (!canUseSessionStorage() || !dataUrl) {
    return
  }

  const now = Date.now()
  const sizeBytes = Math.max(Number(blobSize || 0), estimateStringBytes(dataUrl))
  if (!sizeBytes || sizeBytes > profile.maxBytes) {
    return
  }

  let nextIndex = readCacheIndex()
  nextIndex = pruneExpiredCacheEntries({ index: nextIndex, profile, now })

  try {
    window.sessionStorage.setItem(cacheKey, dataUrl)
    nextIndex = {
      ...nextIndex,
      [cacheKey]: {
        userCacheKey,
        createdAt: now,
        lastAccessAt: now,
        sizeBytes,
      },
    }
    nextIndex = enforceUserCacheBudget({
      index: nextIndex,
      profile,
      userCacheKey,
    })
    writeCacheIndex(nextIndex)
  } catch {
    let recoveredIndex = enforceUserCacheBudget({
      index: nextIndex,
      profile: {
        ...profile,
        maxEntries: Math.max(1, Math.floor(profile.maxEntries * 0.75)),
        maxBytes: Math.max(sizeBytes, Math.floor(profile.maxBytes * 0.75)),
      },
      userCacheKey,
    })
    writeCacheIndex(recoveredIndex)
    try {
      window.sessionStorage.setItem(cacheKey, dataUrl)
      recoveredIndex = {
        ...recoveredIndex,
        [cacheKey]: {
          userCacheKey,
          createdAt: now,
          lastAccessAt: now,
          sizeBytes,
        },
      }
      recoveredIndex = enforceUserCacheBudget({
        index: recoveredIndex,
        profile,
        userCacheKey,
      })
      writeCacheIndex(recoveredIndex)
    } catch {
      return
    }
  }
}

function resolveApiUrl(value) {
  if (!value) {
    return ""
  }
  if (/^https?:\/\//i.test(value)) {
    return value
  }
  if (value.startsWith("/")) {
    return `${API_BASE_URL}${value}`
  }
  return `${API_BASE_URL}/${value}`
}

function imageCacheKey({ userCacheKey, messageId, imageUrl }) {
  return `order-chat-image:${userCacheKey}:${messageId}:${imageUrl}`
}

function getUserCacheKey(trackingCode) {
  const token = getAccessToken()
  if (token) {
    return `auth:${token.slice(0, 20)}`
  }
  if (trackingCode) {
    return `guest:${trackingCode}`
  }
  return "anon"
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null
  }
  return {
    id: payload.id,
    sender_kind: payload.sender_kind,
    sender_label: payload.sender_label,
    body: payload.body || "",
    has_image: Boolean(payload.image_url),
    protected_image_url: resolveApiUrl(payload.image_url || ""),
    protected_image_download_url: resolveApiUrl(payload.image_download_url || payload.image_url || ""),
    image_url: "",
    image_download_url: "",
    image_purged: Boolean(payload.image_purged),
    created_at: payload.created_at,
    read_by_customer_at: payload.read_by_customer_at || null,
    read_by_restaurant_at: payload.read_by_restaurant_at || null,
  }
}

function mergeById(current, nextMessage) {
  const exists = current.some((item) => item.id === nextMessage.id)
  if (!exists) {
    return [...current, nextMessage]
  }
  return current.map((item) => (item.id === nextMessage.id ? nextMessage : item))
}

export function useOrderChat({ orderId, trackingCode, enabled = true }) {
  const [chat, setChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState("")
  const [socketState, setSocketState] = useState("idle")
  const [resolvedImages, setResolvedImages] = useState({})

  const socketRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const heartbeatTimerRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const manuallyClosedRef = useRef(false)

  const canConnect = enabled && Boolean(orderId)
  const userCacheKey = useMemo(() => getUserCacheKey(trackingCode), [trackingCode])
  const imageCacheProfile = useMemo(() => getImageCacheProfile(), [])

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
    }
  }, [])

  const closeSocket = useCallback(() => {
    clearTimers()
    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }
    setSocketState("closed")
  }, [clearTimers])

  const loadChat = useCallback(async () => {
    if (!canConnect) {
      setChat(null)
      setMessages([])
      setUnreadCount(0)
      return
    }

    setIsLoading(true)
    try {
      const payload = await getOrderChat(orderId, { trackingCode })
      setChat(payload)
      setUnreadCount(payload.unread_count_for_me || 0)
      setMessages((payload.messages || []).map(normalizePayload).filter(Boolean))
      setError("")
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar el chat")
    } finally {
      setIsLoading(false)
    }
  }, [canConnect, orderId, trackingCode])

  const openSocket = useCallback(() => {
    const token = getAccessToken()
    const url = buildOrderChatSocketUrl(orderId, {
      accessToken: token,
      trackingCode,
    })
    const socket = new WebSocket(url)
    socketRef.current = socket

    socket.onopen = () => {
      reconnectAttemptsRef.current = 0
      setSocketState("open")
      clearTimers()
      heartbeatTimerRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }))
        }
      }, 25000)
    }

    socket.onmessage = (event) => {
      let parsed
      try {
        parsed = JSON.parse(event.data)
      } catch {
        return
      }

      if (parsed.type === "chat.ready") {
        const initial = (parsed.messages || []).map(normalizePayload).filter(Boolean)
        setMessages(initial)
        return
      }
      if (parsed.type === "chat.closed" || parsed.event_type === "chat.closed") {
        setChat((current) => (current ? { ...current, is_closed: true } : current))
        return
      }

      if (parsed.event_type === "chat.message") {
        const message = normalizePayload(parsed.payload)
        if (message) {
          setMessages((current) => mergeById(current, message))
          setUnreadCount((current) => current + 1)
        }
        return
      }

      if (parsed.event_type === "chat.read") {
        setUnreadCount(0)
      }
    }

    socket.onclose = () => {
      clearTimers()
      socketRef.current = null
      setSocketState("closed")
      if (manuallyClosedRef.current || !canConnect || reconnectTimerRef.current) {
        return
      }

      const delay = Math.min(30000, 1000 * (2 ** reconnectAttemptsRef.current))
      reconnectAttemptsRef.current += 1
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null
        setSocketState("reconnecting")
        openSocket()
      }, delay)
    }
  }, [canConnect, clearTimers, orderId, trackingCode])

  useEffect(() => {
    manuallyClosedRef.current = false
    if (!canConnect) {
      closeSocket()
      return
    }

    loadChat()

    setSocketState("connecting")
    openSocket()

    return () => {
      manuallyClosedRef.current = true
      closeSocket()
    }
  }, [canConnect, closeSocket, loadChat, openSocket])

  useEffect(() => {
    if (!messages.length) {
      return
    }

    const controller = new AbortController()
    const token = getAccessToken()

    const resolveImage = async (message) => {
      if (!message?.id || !message?.protected_image_url || message.image_purged) {
        return
      }
      const cacheKey = imageCacheKey({
        userCacheKey,
        messageId: message.id,
        imageUrl: message.protected_image_url,
      })

      const cachedData = getCachedImageData({
        cacheKey,
        userCacheKey,
        profile: imageCacheProfile,
      })
      if (cachedData) {
        setResolvedImages((current) => ({ ...current, [message.id]: cachedData }))
        return
      }

      try {
        const headers = {}
        if (token) {
          headers.Authorization = `Bearer ${token}`
        }

        const requestUrl = (() => {
          if (token || !trackingCode || message.protected_image_url.includes("tracking_code=")) {
            return message.protected_image_url
          }
          const separator = message.protected_image_url.includes("?") ? "&" : "?"
          return `${message.protected_image_url}${separator}tracking_code=${encodeURIComponent(trackingCode)}`
        })()

        const response = await fetch(requestUrl, {
          method: "GET",
          headers,
          credentials: "include",
          signal: controller.signal,
        })

        if (!response.ok) {
          if (response.status === 404 || response.status === 410) {
            setResolvedImages((current) => ({ ...current, [message.id]: "deleted" }))
          }
          return
        }

        const blob = await response.blob()
        const blobSize = blob.size
        const reader = new FileReader()
        const dataUrl = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(String(reader.result || ""))
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })

        if (typeof dataUrl === "string" && dataUrl) {
          setCachedImageData({
            cacheKey,
            userCacheKey,
            dataUrl,
            blobSize,
            profile: imageCacheProfile,
          })
          setResolvedImages((current) => ({ ...current, [message.id]: dataUrl }))
        }
      } catch {
        return
      }
    }

    messages.forEach((message) => {
      resolveImage(message)
    })

    return () => {
      controller.abort()
    }
  }, [imageCacheProfile, messages, trackingCode, userCacheKey])

  const messagesWithResolvedImages = useMemo(
    () => messages.map((message) => {
      const resolved = resolvedImages[message.id]
      if (resolved === "deleted") {
        return {
          ...message,
          has_image: false,
          protected_image_url: "",
          protected_image_download_url: "",
          image_url: "",
          image_download_url: "",
          image_purged: true,
        }
      }
      if (resolved) {
        return {
          ...message,
          image_url: resolved,
          image_download_url: resolved,
        }
      }
      return message
    }),
    [messages, resolvedImages],
  )

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current)
          heartbeatTimerRef.current = null
        }
        return
      }
      const socket = socketRef.current
      if (socket && socket.readyState === WebSocket.OPEN && !heartbeatTimerRef.current) {
        heartbeatTimerRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }))
          }
        }, 25000)
      }
    }

    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  const sendMessage = useCallback(async ({ body, image } = {}) => {
    if (!orderId) {
      return null
    }

    setIsSending(true)
    try {
      const created = await sendOrderChatMessage(orderId, {
        body,
        image,
        trackingCode,
      })
      const next = normalizePayload(created)
      if (next) {
        setMessages((current) => mergeById(current, next))
      }
      return created
    } finally {
      setIsSending(false)
    }
  }, [orderId, trackingCode])

  const markRead = useCallback(async () => {
    if (!orderId) {
      return
    }
    await markOrderChatRead(orderId, { trackingCode })
    setUnreadCount(0)
  }, [orderId, trackingCode])

  return useMemo(() => ({
    chat,
    messages: messagesWithResolvedImages,
    unreadCount,
    isLoading,
    isSending,
    error,
    socketState,
    sendMessage,
    markRead,
    refresh: loadChat,
  }), [
    chat,
    messagesWithResolvedImages,
    unreadCount,
    isLoading,
    isSending,
    error,
    socketState,
    sendMessage,
    markRead,
    loadChat,
  ])
}

export function useOrderChatUnreadCount({ orderId, trackingCode, enabled = true }) {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!enabled || !orderId) {
      setUnreadCount(0)
      return
    }

    let cancelled = false
    getOrderChat(orderId, { trackingCode })
      .then((payload) => {
        if (cancelled) {
          return
        }
        setUnreadCount(payload.unread_count_for_me || 0)
      })
      .catch(() => {
        if (!cancelled) {
          setUnreadCount(0)
        }
      })

    return () => {
      cancelled = true
    }
  }, [enabled, orderId, trackingCode])

  return unreadCount
}
