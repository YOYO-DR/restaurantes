import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Smartphone, CreditCard, BarChart3, Package, Star, Palette, Truck, QrCode, Bell, Users, Shield, ArrowRight } from "lucide-react";
export const metadata = {
    title: "Servicios - FoodHub",
    description: "Conoce todos los servicios que FoodHub ofrece para digitalizar tu restaurante"
};
const services = [
    {
        icon: Smartphone,
        title: "Menu Digital",
        description: "Crea un menu online profesional con categorias, imagenes de alta calidad, precios actualizables y disponibilidad en tiempo real. Tus clientes pueden ver el menu desde cualquier dispositivo.",
        features: ["Categorias personalizables", "Imagenes HD", "Disponibilidad en tiempo real", "Descripciones detalladas"]
    },
    {
        icon: QrCode,
        title: "Codigo QR para Mesas",
        description: "Genera codigos QR unicos para cada mesa de tu restaurante. Los clientes escanean y ven el menu directamente en su celular sin necesidad de descargar apps.",
        features: ["QR por mesa", "Sin app requerida", "Actualizacion automatica", "Estadisticas de escaneo"]
    },
    {
        icon: Truck,
        title: "Sistema de Delivery",
        description: "Gestiona pedidos a domicilio de forma eficiente. Define zonas de cobertura, tarifas de envio y tiempos estimados de entrega.",
        features: ["Zonas de cobertura", "Tarifas dinamicas", "Seguimiento en tiempo real", "Notificaciones automaticas"]
    },
    {
        icon: Package,
        title: "Pickup / Para Llevar",
        description: "Permite a tus clientes hacer pedidos para recoger en tu local. Optimiza tiempos de espera y mejora la experiencia.",
        features: ["Horarios de recogida", "Confirmacion automatica", "Tiempo estimado", "Cola inteligente"]
    },
    {
        icon: CreditCard,
        title: "Pagos Integrados",
        description: "Acepta pagos online de forma segura con Wompy. Tarjetas de credito, debito, PSE, Nequi y efectivo contra entrega.",
        features: ["Tarjetas credito/debito", "PSE", "Nequi", "Efectivo contra entrega"]
    },
    {
        icon: Star,
        title: "Programa de Lealtad",
        description: "Fideliza a tus clientes con un programa de puntos. Por cada compra acumulan puntos que pueden canjear por descuentos o productos.",
        features: ["Acumulacion de puntos", "Niveles de cliente", "Recompensas personalizadas", "Ofertas exclusivas"]
    },
    {
        icon: Package,
        title: "Control de Inventario",
        description: "Gestiona tus ingredientes y stock de forma inteligente. Recibe alertas cuando se agoten productos y evita vender platos no disponibles.",
        features: ["Stock en tiempo real", "Alertas automaticas", "Historial de movimientos", "Reportes de consumo"]
    },
    {
        icon: BarChart3,
        title: "Analytics y Reportes",
        description: "Obtiene insights valiosos sobre tu negocio. Ventas por dia, productos mas vendidos, horarios pico y comportamiento de clientes.",
        features: ["Dashboard en tiempo real", "Reportes exportables", "Tendencias de ventas", "Metricas de clientes"]
    },
    {
        icon: Bell,
        title: "Notificaciones",
        description: "Mantente informado de cada pedido con notificaciones push, email y SMS. Nunca pierdas un pedido importante.",
        features: ["Push notifications", "Email automaticos", "SMS opcional", "Alertas personalizables"]
    },
    {
        icon: Palette,
        title: "Personalizacion Visual",
        description: "Tu restaurante, tu marca. Personaliza colores, logo, tipografias y estilo visual para que tu menu refleje tu identidad.",
        features: ["Colores personalizados", "Logo propio", "Subdominio unico", "Temas predefinidos"]
    },
    {
        icon: Users,
        title: "Gestion de Empleados",
        description: "Administra roles y permisos para tu equipo. Meseros, cocineros y administradores con accesos diferenciados.",
        features: ["Roles personalizados", "Permisos granulares", "Registro de actividad", "Multi-usuario"]
    },
    {
        icon: Shield,
        title: "Seguridad",
        description: "Tus datos y los de tus clientes estan protegidos con los mas altos estandares de seguridad y encriptacion.",
        features: ["Encriptacion SSL", "Backups automaticos", "Cumplimiento GDPR", "Autenticacion segura"]
    }
];
export default function ServiciosPage() {
    return (<div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="border-b border-border bg-muted/30 py-16 lg:py-24">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
                Servicios para tu restaurante
              </h1>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                FoodHub te ofrece todas las herramientas que necesitas para digitalizar tu negocio, aumentar tus ventas y mejorar la experiencia de tus clientes.
              </p>
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Button size="lg" asChild>
                  <Link to="/registro">
                    Empezar gratis
                    <ArrowRight className="ml-2 h-4 w-4"/>
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/precios">Ver precios</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-24">
          <div className="container mx-auto px-4">
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {services.map((service, index) => (<Card key={index} className="group transition-all hover:shadow-lg hover:border-primary/50">
                  <CardHeader>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                      <service.icon className="h-6 w-6 text-primary"/>
                    </div>
                    <CardTitle className="mt-4">{service.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {service.description}
                    </p>
                    <ul className="grid grid-cols-2 gap-2">
                      {service.features.map((feature, featureIndex) => (<li key={featureIndex} className="flex items-center gap-2 text-sm">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary"/>
                          {feature}
                        </li>))}
                    </ul>
                  </CardContent>
                </Card>))}
            </div>
          </div>
        </section>

        <section className="bg-primary py-16 lg:py-24">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-2xl font-bold text-primary-foreground md:text-3xl">
                Listo para digitalizar tu restaurante?
              </h2>
              <p className="mt-4 text-primary-foreground/80">
                Unete a mas de 100 restaurantes que ya estan creciendo con FoodHub.
              </p>
              <Button size="lg" variant="secondary" className="mt-8" asChild>
                <Link to="/registro">
                  Crear cuenta gratis
                  <ArrowRight className="ml-2 h-4 w-4"/>
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>);
}
