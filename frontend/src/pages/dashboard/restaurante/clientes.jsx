import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TableSkeleton } from "@/components/ui/app-skeletons"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useOwnerCustomers } from "@/hooks/use-orders"
import { formatCurrency } from "@/lib/format"
import { Award, Eye, Mail, MoreHorizontal, Search, ShoppingBag, Star, TrendingUp, Users } from "lucide-react"

const tierStyles = {
  Base: "bg-muted text-foreground",
  Bronce: "bg-amber-700 text-amber-50",
  Plata: "bg-gray-400 text-gray-900",
  Oro: "bg-yellow-500 text-yellow-950",
  Platino: "bg-gradient-to-r from-gray-300 to-gray-500 text-gray-900",
}

export default function ClientesRestaurantePage() {
  const [orderScope, setOrderScope] = useState("all")
  const { data, isLoading, error } = useOwnerCustomers(orderScope)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedClient, setSelectedClient] = useState(null)

  const filteredClients = useMemo(
    () =>
      data.customers.filter(
        (client) =>
          client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          client.email.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [data.customers, searchQuery],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <div className="space-y-2">
          <p className="text-muted-foreground">Gestiona y conoce a tus clientes</p>
          <Select value={orderScope} onValueChange={(value) => setOrderScope(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas las ordenes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las ordenes</SelectItem>
              <SelectItem value="completed">Completadas</SelectItem>
              <SelectItem value="non_completed">No finalizadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? <TableSkeleton /> : null}
      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      {isLoading ? null : (
        <>
          {!data.loyalty?.is_active ? (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="py-4 text-sm text-amber-900">
                Tu programa de puntos esta desactivado. Activalo en Configuracion &gt; Lealtad.
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<Users className="h-6 w-6 text-primary" />} label="Total Clientes" value={data.metrics.total_customers} />
            <StatCard icon={<TrendingUp className="h-6 w-6 text-green-500" />} label="Nuevos este mes" value={data.metrics.new_customers_this_month} />
            <StatCard icon={<ShoppingBag className="h-6 w-6 text-accent" />} label="Ticket Promedio" value={formatCurrency(data.metrics.average_ticket)} />
            <StatCard icon={<Star className="h-6 w-6 text-yellow-500" />} label="Clientes VIP" value={data.metrics.vip_customers} />
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Lista de Clientes</CardTitle>
                  <CardDescription>{filteredClients.length} clientes encontrados</CardDescription>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar cliente..." className="pl-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    {data.loyalty?.is_active ? <TableHead>Nivel</TableHead> : null}
                    <TableHead className="hidden md:table-cell">Pedidos</TableHead>
                    <TableHead className="hidden lg:table-cell">Total Gastado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {client.name.split(" ").map((part) => part[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{client.name}</p>
                            <p className="text-sm text-muted-foreground">{client.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      {data.loyalty?.is_active ? (
                        <TableCell>
                          <Badge className={tierStyles[client.tier] || tierStyles.Base}>{client.tier}</Badge>
                        </TableCell>
                      ) : null}
                      <TableCell className="hidden md:table-cell">{client.total_orders}</TableCell>
                      <TableCell className="hidden lg:table-cell">{formatCurrency(client.total_spent)}</TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DialogTrigger asChild onClick={() => setSelectedClient(client)}>
                                <DropdownMenuItem>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Ver detalles
                                </DropdownMenuItem>
                              </DialogTrigger>
                              <DropdownMenuItem disabled>
                                <Mail className="mr-2 h-4 w-4" />
                                Enviar correo
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled>
                                <Award className="mr-2 h-4 w-4" />
                                Dar puntos extra
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Detalles del Cliente</DialogTitle>
                              <DialogDescription>Informacion completa del cliente</DialogDescription>
                            </DialogHeader>
                            {selectedClient ? (
                              <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                  <Avatar className="h-16 w-16">
                                    <AvatarFallback className="bg-primary/10 text-xl text-primary">
                                      {selectedClient.name.split(" ").map((part) => part[0]).join("")}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <h3 className="text-lg font-semibold">{selectedClient.name}</h3>
                                    <Badge className={tierStyles[selectedClient.tier] || tierStyles.Base}>{selectedClient.tier}</Badge>
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                  <MetricBlock label="Pedidos" value={selectedClient.total_orders} />
                                  {data.loyalty?.is_active ? <MetricBlock label="Puntos" value={selectedClient.points} /> : null}
                                  <MetricBlock label="Gastado" value={formatCurrency(selectedClient.total_spent)} compact />
                                </div>

                                <div>
                                  <p className="mb-2 text-sm font-medium">Platos favoritos</p>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedClient.favorite_items.map((item) => (
                                      <Badge key={item} variant="secondary">{item}</Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function StatCard({ icon, label, value }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">{icon}</div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MetricBlock({ label, value, compact = false }) {
  return (
    <div className="rounded-lg bg-muted p-3 text-center">
      <p className={compact ? "text-lg font-bold" : "text-2xl font-bold"}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
