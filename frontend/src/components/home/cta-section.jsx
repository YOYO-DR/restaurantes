import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
export function CTASection() {
    return (<section className="bg-primary py-20 lg:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary-foreground md:text-4xl">
            Listo para digitalizar tu restaurante?
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/80">
            Unete a mas de 100 restaurantes que ya estan creciendo con FoodHub. 
            Empieza gratis y escala cuando lo necesites.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" variant="secondary" asChild>
              <Link to="/registro">
                Crear cuenta gratis
                <ArrowRight className="ml-2 h-4 w-4"/>
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
              <Link to="/restaurantes">Ver restaurantes</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>);
}
