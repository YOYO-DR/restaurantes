export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

let accessToken = null
const authFailureListeners = new Set()

function notifyAuthFailure() {
  authFailureListeners.forEach((listener) => {
    listener()
  })
}

export function setAccessToken(token) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

export function clearAccessToken() {
  accessToken = null
}

export function onAuthFailure(listener) {
  authFailureListeners.add(listener)
  return () => {
    authFailureListeners.delete(listener)
  }
}

export async function apiRequest(path, options = {}, retry = true) {
  const isFormDataBody = options.body instanceof FormData
  const headers = {
    ...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  })

  if (response.status === 401 && retry) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return apiRequest(path, options, false)
    }
  }

  return response
}

let refreshPromise = null

export async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      clearAccessToken()
      notifyAuthFailure()
      return false
    }

    const data = await response.json()
    if (!data.access) {
      clearAccessToken()
      notifyAuthFailure()
      return false
    }

    setAccessToken(data.access)
    return true
  })().finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}

export async function apiJson(path, options = {}, retry = true) {
  const response = await apiRequest(path, options, retry)
  const contentType = response.headers.get("content-type") || ""
  const data = contentType.includes("application/json") ? await response.json() : null

  if (!response.ok) {
    const firstFieldError = data && typeof data === "object"
      ? Object.values(data).find((value) => Array.isArray(value) && value.length > 0)?.[0]
      : null
    const errorMessage = data?.detail || data?.non_field_errors?.[0] || firstFieldError || "Request failed"
    throw new Error(errorMessage)
  }

  return data
}
