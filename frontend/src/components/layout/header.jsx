import { Link } from "react-router-dom"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { useAuth } from "@/context/auth-context"
import { dashboardPathByRole } from "@/lib/auth-routing"
import { Menu, Utensils, X } from "lucide-react"

export function Header({ showThemeToggle = true }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { user, isAuthenticated } = useAuth()
  const dashboardPath = isAuthenticated && user ? dashboardPathByRole(user.role) : null

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Utensils className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">FoodHub</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link to="/restaurantes" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Restaurantes
          </Link>
          <Link to="/servicios" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Servicios
          </Link>
          <Link to="/precios" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Precios
          </Link>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {showThemeToggle ? <ThemeToggle /> : null}
          {dashboardPath ? (
            <Button asChild>
              <Link to={dashboardPath}>Ir al dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/login">Iniciar Sesion</Link>
              </Button>
              <Button asChild>
                <Link to="/registro">Registrarse</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg md:hidden"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isMenuOpen ? (
        <div className="border-t border-border bg-background px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-4">
            <Link to="/restaurantes" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" onClick={() => setIsMenuOpen(false)}>
              Restaurantes
            </Link>
            <Link to="/servicios" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" onClick={() => setIsMenuOpen(false)}>
              Servicios
            </Link>
            <Link to="/precios" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" onClick={() => setIsMenuOpen(false)}>
              Precios
            </Link>
            <div className="flex flex-col gap-2 pt-4">
              {showThemeToggle ? (
                <div className="flex justify-start">
                  <ThemeToggle />
                </div>
              ) : null}
              {dashboardPath ? (
                <Button asChild>
                  <Link to={dashboardPath} onClick={() => setIsMenuOpen(false)}>
                    Ir al dashboard
                  </Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" asChild className="justify-start">
                    <Link to="/login" onClick={() => setIsMenuOpen(false)}>
                      Iniciar Sesion
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link to="/registro" onClick={() => setIsMenuOpen(false)}>
                      Registrarse
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  )
}
