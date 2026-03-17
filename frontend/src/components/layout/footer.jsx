import { Link } from "react-router-dom";
import { Utensils, Facebook, Instagram, Twitter } from "lucide-react";
export function Footer() {
    return (<footer className="border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <Utensils className="h-5 w-5 text-primary-foreground"/>
              </div>
              <span className="text-xl font-bold tracking-tight">FoodHub</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Digitaliza tu restaurante con menu online, pedidos delivery y pickup, pagos integrados y programa de lealtad.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Facebook className="h-5 w-5"/>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Instagram className="h-5 w-5"/>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Twitter className="h-5 w-5"/>
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Plataforma</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/restaurantes" className="text-muted-foreground hover:text-foreground transition-colors">
                  Restaurantes
                </Link>
              </li>
              <li>
                <Link to="/servicios" className="text-muted-foreground hover:text-foreground transition-colors">
                  Servicios
                </Link>
              </li>
              <li>
                <Link to="/precios" className="text-muted-foreground hover:text-foreground transition-colors">
                  Precios
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Soporte</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Centro de ayuda
                </Link>
              </li>
              <li>
                <Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Contacto
                </Link>
              </li>
              <li>
                <Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Legal</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Terminos de servicio
                </Link>
              </li>
              <li>
                <Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Politica de privacidad
                </Link>
              </li>
              <li>
                <Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  Cookies
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} FoodHub. Todos los derechos reservados. Corinto, Cauca, Colombia.</p>
        </div>
      </div>
    </footer>);
}
