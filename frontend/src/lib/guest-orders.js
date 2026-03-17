const STORAGE_KEY = "foodhub-guest-orders"
const TTL_MS = 24 * 60 * 60 * 1000

function isClient() {
  return typeof window !== "undefined"
}

function readEntries() {
  if (!isClient()) {
    return []
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeEntries(entries) {
  if (!isClient()) {
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export function pruneGuestOrders() {
  const now = Date.now()
  const nextEntries = readEntries().filter((entry) => {
    const createdAt = new Date(entry.created_at || entry.saved_at || now).getTime()
    return now - createdAt <= TTL_MS
  })
  writeEntries(nextEntries)
  return nextEntries
}

export function saveGuestOrder(order) {
  const entries = pruneGuestOrders().filter((entry) => entry.id !== order.id)
  entries.unshift({
    id: order.id,
    tracking_code: order.guest_tracking_code || "",
    order_code: order.order_code,
    restaurant_name: order.restaurant_name,
    status_code: order.status_code,
    status_name: order.status_name,
    order_type_code: order.order_type_code,
    created_at: order.created_at,
    saved_at: new Date().toISOString(),
  })
  writeEntries(entries)
  return entries
}

export function getGuestOrders() {
  return pruneGuestOrders()
}

export function removeGuestOrder(orderIdentifier) {
  const entries = pruneGuestOrders().filter((entry) => {
    if (entry.id === orderIdentifier || entry.tracking_code === orderIdentifier) {
      return false
    }
    return true
  })
  writeEntries(entries)
  return entries
}
