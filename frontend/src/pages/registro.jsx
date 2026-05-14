import { Link } from "react-router-dom";
import { RegisterForm } from "@/components/auth/register-form";
import { ArrowLeft, Utensils } from "lucide-react";
export const metadata = {
    title: "Registrarse - FoodHub",
    description: "Crea tu cuenta en FoodHub como cliente o dueno de restaurante"
};
export default function RegisterPage() {
    return (<div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-primary lg:flex lg:flex-col lg:justify-between p-12">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground">
            <Utensils className="h-6 w-6 text-primary"/>
          </div>
          <span className="text-xl font-bold text-primary-foreground">FoodHub</span>
        </Link>
        
        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-primary-foreground leading-tight">
            Unete a FoodHub hoy
          </h1>
          <p className="text-lg text-primary-foreground/80 leading-relaxed">
            Ya seas cliente buscando los mejores restaurantes o dueno queriendo digitalizar tu negocio, FoodHub es para ti.
          </p>
          <ul className="space-y-3 text-primary-foreground/80">
            <li className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-primary-foreground"/>
              Menu digital y pedidos online
            </li>
            <li className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-primary-foreground"/>
              Delivery y pickup integrados
            </li>
            <li className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-primary-foreground"/>
              Programa de lealtad y puntos
            </li>
          </ul>
        </div>

        <p className="text-sm text-primary-foreground/60">
          &copy; {new Date().getFullYear()} FoodHub. Todos los derechos reservados.
        </p>
      </div>

      <div className="flex w-full flex-col justify-center px-4 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio
            </Link>
          </div>

          <div className="mb-8 lg:hidden">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <Utensils className="h-5 w-5 text-primary-foreground"/>
              </div>
              <span className="text-xl font-bold">FoodHub</span>
            </Link>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Crear cuenta</h2>
            <p className="text-muted-foreground">
              Completa el formulario para registrarte en FoodHub
            </p>
          </div>

          <RegisterForm />

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Ya tienes cuenta?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Inicia sesion
            </Link>
          </p>
        </div>
      </div>
    </div>);
}
