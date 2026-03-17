import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
const plans = [
    {
        name: "Basico",
        price: "$10",
        period: "/mes",
        description: "Perfecto para empezar",
        features: [
            "Menu digital ilimitado",
            "Pedidos pickup",
            "Panel de control basico",
            "Soporte por email",
            "1 usuario"
        ],
        cta: "Empezar gratis",
        highlighted: false
    },
    {
        name: "Profesional",
        price: "$25",
        period: "/mes",
        description: "Para restaurantes en crecimiento",
        features: [
            "Todo del plan Basico",
            "Pedidos delivery",
            "Pagos online con Wompy",
            "Programa de lealtad",
            "Analytics avanzados",
            "3 usuarios",
            "Soporte prioritario"
        ],
        cta: "Empezar ahora",
        highlighted: true
    },
    {
        name: "Empresarial",
        price: "$50",
        period: "/mes",
        description: "Para multiples locales",
        features: [
            "Todo del plan Profesional",
            "Multi-sucursal",
            "Control de inventario",
            "API personalizada",
            "Usuarios ilimitados",
            "Soporte dedicado",
            "Capacitacion incluida"
        ],
        cta: "Contactar ventas",
        highlighted: false
    }
];
export function PricingSection() {
    return (<section className="py-20 lg:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Planes para cada negocio
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Elige el plan que mejor se adapte a tu restaurante. Sin costos ocultos.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {plans.map((plan, index) => (<div key={index} className={`relative rounded-2xl border ${plan.highlighted
                ? "border-primary bg-primary/5 shadow-lg"
                : "border-border bg-card"} p-8`}>
              {plan.highlighted && (<div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-sm font-medium text-primary-foreground">
                  Mas popular
                </div>)}
              <div>
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="ml-1 text-muted-foreground">{plan.period}</span>
                </div>
              </div>

              <ul className="mt-8 space-y-4">
                {plan.features.map((feature, featureIndex) => (<li key={featureIndex} className="flex items-center gap-3">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                      <Check className="h-3 w-3 text-primary"/>
                    </div>
                    <span className="text-sm">{feature}</span>
                  </li>))}
              </ul>

              <Button className="mt-8 w-full" variant={plan.highlighted ? "default" : "outline"} asChild>
                <Link to="/registro">{plan.cta}</Link>
              </Button>
            </div>))}
        </div>
      </div>
    </section>);
}
