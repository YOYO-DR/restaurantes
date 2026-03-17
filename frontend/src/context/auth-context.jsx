import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  apiJson,
  clearAccessToken,
  onAuthFailure,
  refreshAccessToken,
  setAccessToken,
} from "@/lib/api"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionExpiredAt, setSessionExpiredAt] = useState(null)
  const userRef = useRef(null)

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    return onAuthFailure(() => {
      if (!userRef.current) {
        return
      }

      clearAccessToken()
      setUser(null)
      setSessionExpiredAt(Date.now())
      toast.error("Tu sesion expiro. Inicia sesion de nuevo.")
    })
  }, [])

  const loadSession = async () => {
    try {
      const refreshed = await refreshAccessToken()
      if (!refreshed) {
        setUser(null)
        return
      }

      const me = await apiJson("/api/auth/me/")
      setUser(me)
    } catch {
      clearAccessToken()
      setUser(null)
    }
  }

  useEffect(() => {
    loadSession().finally(() => setIsLoading(false))
  }, [])

  const login = async ({ email, password }) => {
    const data = await apiJson("/api/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
    setAccessToken(data.access)
    setUser(data.user)
    return data.user
  }

  const register = async (payload) => {
    const data = await apiJson("/api/auth/register/", {
      method: "POST",
      body: JSON.stringify(payload),
    })
    setAccessToken(data.access)
    setUser(data.user)
    return data.user
  }

  const logout = async () => {
    try {
      await apiJson("/api/auth/logout/", {
        method: "POST",
        body: JSON.stringify({}),
      })
    } finally {
      clearAccessToken()
      setUser(null)
    }
  }

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      sessionExpiredAt,
      login,
      register,
      logout,
    }),
    [user, isLoading, sessionExpiredAt],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
