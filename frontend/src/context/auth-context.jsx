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
const ACTIVE_ROLE_STORAGE_KEY = "foodhub.active-role"

function getBestActiveRole(user, requestedRole = "") {
  const roles = user?.roles || (user?.role ? [user.role] : ["cliente"])
  if (requestedRole && roles.includes(requestedRole)) {
    return requestedRole
  }
  return roles[0] || "cliente"
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [activeRole, setActiveRoleState] = useState("cliente")
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
      setActiveRoleState("cliente")
      localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY)
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
      const storedRole = localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY) || ""
      const nextRole = getBestActiveRole(me, storedRole)
      setActiveRoleState(nextRole)
      localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, nextRole)
    } catch {
      clearAccessToken()
      setUser(null)
      setActiveRoleState("cliente")
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
    const nextRole = getBestActiveRole(data.user)
    setActiveRoleState(nextRole)
    localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, nextRole)
    return data.user
  }

  const register = async (payload) => {
    const data = await apiJson("/api/auth/register/", {
      method: "POST",
      body: JSON.stringify(payload),
    })
    setAccessToken(data.access)
    setUser(data.user)
    const nextRole = getBestActiveRole(data.user)
    setActiveRoleState(nextRole)
    localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, nextRole)
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
      setActiveRoleState("cliente")
      localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY)
    }
  }

  const switchRole = (roleCode) => {
    const nextRole = getBestActiveRole(user, roleCode)
    setActiveRoleState(nextRole)
    localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, nextRole)
    return nextRole
  }

  const value = useMemo(
    () => ({
      user,
      activeRole,
      availableRoles: user?.available_roles || [],
      isLoading,
      isAuthenticated: Boolean(user),
      sessionExpiredAt,
      login,
      register,
      logout,
      switchRole,
    }),
    [user, activeRole, isLoading, sessionExpiredAt],
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
