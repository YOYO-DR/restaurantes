import { useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/auth-context"

const PUBLIC_PATH_PREFIXES = [
  "/",
  "/login",
  "/registro",
  "/restaurantes",
  "/servicios",
  "/precios",
  "/checkout",
  "/mis-pedidos",
  "/recuperar-contrasena",
]

function isPublicPath(pathname) {
  return PUBLIC_PATH_PREFIXES.some((path) => {
    if (path === "/") {
      return pathname === "/"
    }
    return pathname === path || pathname.startsWith(`${path}/`)
  })
}

export function AuthSessionProvider({ children }) {
  const { sessionExpiredAt } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!sessionExpiredAt) {
      return
    }

    if (isPublicPath(location.pathname)) {
      return
    }

    navigate("/login", {
      replace: true,
      state: {
        from: `${location.pathname}${location.search}${location.hash}`,
      },
    })
  }, [location.hash, location.pathname, location.search, navigate, sessionExpiredAt])

  return children
}
