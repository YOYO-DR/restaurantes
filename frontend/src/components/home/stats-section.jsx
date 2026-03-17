export function StatsSection() {
    const stats = [
        { value: "100+", label: "Restaurantes activos" },
        { value: "50K+", label: "Pedidos procesados" },
        { value: "98%", label: "Clientes satisfechos" },
        { value: "$2M+", label: "Ventas generadas" },
    ];
    return (<section className="border-y border-border bg-muted/30 py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat, index) => (<div key={index} className="text-center">
              <p className="text-3xl font-bold text-primary md:text-4xl">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>))}
        </div>
      </div>
    </section>);
}
