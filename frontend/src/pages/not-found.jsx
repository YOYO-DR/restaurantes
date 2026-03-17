import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.3em] text-primary">404</p>
      <h1 className="text-3xl font-bold tracking-tight">Pagina no encontrada</h1>
      <p className="max-w-md text-muted-foreground">
        La ruta solicitada no existe en esta version migrada de FoodHub.
      </p>
      <Button asChild>
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  )
}
