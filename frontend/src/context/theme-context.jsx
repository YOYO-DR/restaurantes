import { createContext, useContext, useEffect, useMemo, useState } from "react"

const STORAGE_KEY = "foodhub-theme"
const ThemeContext = createContext(null)

function getInitialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === "light" || stored === "dark") {
    return stored
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  return prefersDark ? "dark" : "light"
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => getInitialTheme())

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((previousTheme) => (previousTheme === "dark" ? "light" : "dark"))
  }

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}
