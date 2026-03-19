export function dashboardPathByRole(role) {
    if (role === "admin") {
        return "/dashboard/admin"
    }
    if (role === "restaurante" || role === "dueno") {
        return "/dashboard/restaurante"
    }
    return "/dashboard/cliente"
}

function dashboardPrefixByRole(role) {
  if (role === "admin") {
    return "/dashboard/admin"
  }
  if (role === "restaurante" || role === "dueno") {
    return "/dashboard/restaurante"
  }
  return "/dashboard/cliente"
}

export function resolvePostAuthPath(role, requestedPath) {
  const fallbackPath = dashboardPathByRole(role)

  if (!requestedPath || typeof requestedPath !== "string") {
    return fallbackPath
  }

  if (!requestedPath.startsWith("/")) {
    return fallbackPath
  }

  const dashboardPrefix = dashboardPrefixByRole(role)
  if (!requestedPath.startsWith(dashboardPrefix)) {
    return fallbackPath
  }

  return requestedPath
}
