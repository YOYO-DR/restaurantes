export function HowItWorksSection() {
    const steps = [
        {
            number: "1",
            title: "Registra tu restaurante",
            description: "Crea tu cuenta gratis y configura tu perfil de negocio con logo, horarios y ubicacion."
        },
        {
            number: "2",
            title: "Crea tu menu",
            description: "Agrega tus platos con fotos, precios, categorias y opciones de personalizacion."
        },
        {
            number: "3",
            title: "Recibe pedidos",
            description: "Los clientes hacen pedidos online y tu los recibes en tiempo real en tu panel."
        },
        {
            number: "4",
            title: "Crece tu negocio",
            description: "Analiza tus ventas, fideliza clientes y aumenta tus ingresos mes a mes."
        }
    ];
    return (<section className="bg-muted/30 py-20 lg:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Como funciona
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Empieza a recibir pedidos online en minutos
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (<div key={index} className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                  {step.number}
                </div>
                <h3 className="mt-6 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
              {index < steps.length - 1 && (<div className="absolute left-1/2 top-7 hidden h-0.5 w-full -translate-y-1/2 bg-border lg:block"/>)}
            </div>))}
        </div>
      </div>
    </section>);
}
