import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Smartphone, CreditCard, TrendingUp } from "lucide-react";
export function HeroSection() {
    return (<section className="relative overflow-hidden bg-background py-20 lg:py-32">
      <div className="absolute inset-0 -z-10">
        <div className="absolute right-0 top-0 h-[500px] w-[500px] -translate-y-1/4 translate-x-1/4 rounded-full bg-primary/5 blur-3xl"/>
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] translate-y-1/4 -translate-x-1/4 rounded-full bg-accent/5 blur-3xl"/>
      </div>
      
      <div className="container mx-auto px-4">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="space-y-8">
            <div className="inline-flex items-center rounded-full border border-border bg-muted/50 px-4 py-1.5 text-sm">
              <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
              Plataforma activa en Colombia
            </div>
            
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-balance md:text-5xl lg:text-6xl">
              Digitaliza tu restaurante y{" "}
              <span className="text-primary">aumenta tus ventas</span>
            </h1>
            
            <p className="max-w-xl text-lg text-muted-foreground leading-relaxed">
              Menu online, pedidos delivery y pickup, pagos integrados con Wompy, programa de lealtad y control de inventario. Todo en una sola plataforma.
            </p>
            
            <div className="flex flex-col gap-4 sm:flex-row">
              <Button size="lg" asChild>
                <Link to="/registro">
                  Empieza gratis
                  <ArrowRight className="ml-2 h-4 w-4"/>
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/restaurantes">Ver restaurantes</Link>
              </Button>
            </div>

            <div className="flex items-center gap-8 pt-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Smartphone className="h-5 w-5 text-primary"/>
                </div>
                <span className="text-sm text-muted-foreground">Menu digital</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <CreditCard className="h-5 w-5 text-primary"/>
                </div>
                <span className="text-sm text-muted-foreground">Pagos online</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary"/>
                </div>
                <span className="text-sm text-muted-foreground">Analytics</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="relative rounded-2xl border border-border bg-card p-2 shadow-2xl">
              <div className="overflow-hidden rounded-xl bg-muted">
                <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-3">
                  <div className="h-3 w-3 rounded-full bg-red-400"/>
                  <div className="h-3 w-3 rounded-full bg-yellow-400"/>
                  <div className="h-3 w-3 rounded-full bg-green-400"/>
                  <span className="ml-4 text-sm text-muted-foreground">foodhub.co/mi-restaurante</span>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="h-8 w-32 rounded-lg bg-primary/20"/>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 rounded-xl border border-border bg-card p-4">
                        <div className="h-20 rounded-lg bg-accent/30"/>
                        <div className="h-4 w-24 rounded bg-muted-foreground/20"/>
                        <div className="h-3 w-16 rounded bg-primary/30"/>
                      </div>
                      <div className="space-y-2 rounded-xl border border-border bg-card p-4">
                        <div className="h-20 rounded-lg bg-accent/30"/>
                        <div className="h-4 w-20 rounded bg-muted-foreground/20"/>
                        <div className="h-3 w-14 rounded bg-primary/30"/>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 rounded-xl border border-border bg-card p-4">
                        <div className="h-20 rounded-lg bg-accent/30"/>
                        <div className="h-4 w-28 rounded bg-muted-foreground/20"/>
                        <div className="h-3 w-12 rounded bg-primary/30"/>
                      </div>
                      <div className="space-y-2 rounded-xl border border-border bg-card p-4">
                        <div className="h-20 rounded-lg bg-accent/30"/>
                        <div className="h-4 w-22 rounded bg-muted-foreground/20"/>
                        <div className="h-3 w-16 rounded bg-primary/30"/>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 rounded-xl border border-border bg-card p-4 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <TrendingUp className="h-5 w-5 text-green-600"/>
                </div>
                <div>
                  <p className="text-sm font-medium">+45% ventas</p>
                  <p className="text-xs text-muted-foreground">Este mes</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>);
}
