import { Link } from "react-router-dom"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function RecuperarContrasenaPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Recuperar contrasena</CardTitle>
            <CardDescription>
              Esta vista reemplaza la ruta faltante del template con una solucion simple y coherente para la SPA.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electronico</Label>
              <Input id="email" type="email" placeholder="correo@ejemplo.com" />
            </div>
            <Button className="w-full">Enviar enlace de recuperacion</Button>
            <p className="text-center text-sm text-muted-foreground">
              Recordaste tu clave?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Volver a iniciar sesion
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
