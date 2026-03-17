import { Smartphone, CreditCard, BarChart3, Package, Star, Palette, Truck, Clock } from "lucide-react";
const features = [
    {
        icon: Smartphone,
        title: "Menu Digital",
        description: "Menu online con categorias, imagenes, precios y disponibilidad en tiempo real. Codigo QR para mesas."
    },
    {
        icon: Truck,
        title: "Delivery y Pickup",
        description: "Sistema de pedidos para entrega a domicilio y recoger en local. Seguimiento en tiempo real."
    },
    {
        icon: CreditCard,
        title: "Pagos Integrados",
        description: "Acepta pagos con Wompy. Tarjetas, PSE, Nequi y efectivo contra entrega."
    },
    {
        icon: Star,
        title: "Programa de Lealtad",
        description: "Acumula puntos por cada compra. Canjea por descuentos y productos gratis."
    },
    {
        icon: Package,
        title: "Control de Inventario",
        description: "Gestiona ingredientes y stock. Alertas automaticas cuando se agota un producto."
    },
    {
        icon: BarChart3,
        title: "Analytics Avanzados",
        description: "Reportes de ventas, productos mas vendidos, horarios pico y comportamiento de clientes."
    },
    {
        icon: Palette,
        title: "Personalizacion",
        description: "Colores, logo y marca propia. Tu restaurante con tu identidad visual."
    },
    {
        icon: Clock,
        title: "Horarios Flexibles",
        description: "Configura horarios de atencion, dias especiales y temporadas."
    }
];
export function FeaturesSection() {
    return (<section className="py-20 lg:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Todo lo que necesitas para tu restaurante
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Una plataforma completa para digitalizar tu negocio y aumentar tus ventas.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (<div key={index} className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                <feature.icon className="h-6 w-6 text-primary"/>
              </div>
              <h3 className="mt-4 font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>))}
        </div>
      </div>
    </section>);
}
