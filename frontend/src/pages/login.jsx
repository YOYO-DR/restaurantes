import { Link } from "react-router-dom";
import { LoginForm } from "@/components/auth/login-form";
import { Utensils } from "lucide-react";

export const metadata = {
    title: "Iniciar Sesion - FoodHub",
    description: "Inicia sesion en tu cuenta de FoodHub"
};


export default function LoginPage() {
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
            Bienvenido de vuelta a FoodHub
          </h1>
          <p className="text-lg text-primary-foreground/80 leading-relaxed">
            Gestiona tu restaurante, recibe pedidos y crece tu negocio desde una sola plataforma.
          </p>
        </div>

        <p className="text-sm text-primary-foreground/60">
          &copy; {new Date().getFullYear()} FoodHub. Todos los derechos reservados.
        </p>
      </div>

      <div className="flex w-full flex-col justify-center px-4 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <Utensils className="h-5 w-5 text-primary-foreground"/>
              </div>
              <span className="text-xl font-bold">FoodHub</span>
            </Link>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Iniciar sesion</h2>
            <p className="text-muted-foreground">
              Ingresa tus credenciales para acceder a tu cuenta
            </p>
          </div>

          <LoginForm />

          <p className="mt-8 text-center text-sm text-muted-foreground">
            No tienes cuenta?{" "}
            <Link to="/registro" className="font-medium text-primary hover:underline">
              Registrate aqui
            </Link>
          </p>
        </div>
      </div>
    </div>);
}
