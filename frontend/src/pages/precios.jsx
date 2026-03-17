import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { PricingSection } from "@/components/home/pricing-section"
import { CTASection } from "@/components/home/cta-section"

export default function PreciosPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="border-b border-border bg-muted/30 py-16 lg:py-24">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
              Precios claros para cada etapa
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Mantuvimos la seccion de precios del template como una pagina dedicada para que la navegacion principal funcione como SPA.
            </p>
          </div>
        </section>
        <PricingSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}
