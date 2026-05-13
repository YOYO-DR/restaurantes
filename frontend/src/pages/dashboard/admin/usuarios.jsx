import { useEffect, useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Loader2,
  Search,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react"

import { DashboardShellSkeleton } from "@/components/ui/app-skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAdminUsers } from "@/hooks/use-admin"

const ROLE_META = {
  cliente: { label: "Cliente", className: "bg-sky-100 text-sky-800", icon: UserRound },
  restaurante: { label: "Restaurante", className: "bg-amber-100 text-amber-800", icon: Store },
  admin: { label: "Admin", className: "bg-rose-100 text-rose-800", icon: ShieldCheck },
}

const STATUS_LABELS = {
  active: "Activo",
  inactive: "Inactivo",
  suspended: "Suspendido",
}

const PAGE_SIZE_OPTIONS = [10, 25, 50]

const COLUMNS = [
  { key: "name", label: "Usuario" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Telefono" },
  { key: "role", label: "Rol" },
  { key: "status", label: "Estado" },
  { key: "orders_count", label: "Pedidos" },
  { key: "joined_at", label: "Registro" },
]

function useDebouncedValue(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

export default function AdminUsers() {
  const [filters, setFilters] = useState({
    name: "",
    email: "",
    phone: "",
    role: "todos",
    status: "todos",
    ordersCount: "",
    joinedAt: "",
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [ordering, setOrdering] = useState("-joined_at")

  const debouncedName = useDebouncedValue(filters.name)
  const debouncedEmail = useDebouncedValue(filters.email)
  const debouncedPhone = useDebouncedValue(filters.phone)
  const debouncedOrdersCount = useDebouncedValue(filters.ordersCount)
  const debouncedJoinedAt = useDebouncedValue(filters.joinedAt)

  const query = useMemo(
    () => ({
      page,
      pageSize,
      ordering,
      name: debouncedName.trim(),
      email: debouncedEmail.trim(),
      phone: debouncedPhone.trim(),
      role: filters.role,
      status: filters.status,
      ordersCount: debouncedOrdersCount.trim(),
      joinedAt: debouncedJoinedAt,
    }),
    [
      debouncedEmail,
      debouncedJoinedAt,
      debouncedName,
      debouncedOrdersCount,
      debouncedPhone,
      filters.role,
      filters.status,
      ordering,
      page,
      pageSize,
    ],
  )

  const { data, isLoading, error } = useAdminUsers(query)

  useEffect(() => {
    setPage(1)
  }, [debouncedEmail, debouncedJoinedAt, debouncedName, debouncedOrdersCount, debouncedPhone, filters.role, filters.status, ordering, pageSize])

  const toggleOrdering = (columnKey) => {
    setOrdering((current) => {
      if (current === columnKey) return `-${columnKey}`
      if (current === `-${columnKey}`) return columnKey
      return columnKey
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Gestion de usuarios</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tabla adaptable con paginacion, filtros y ordenamiento hechos en API para soportar volumen alto.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard title="Total filtrado" value={data?.counts?.total ?? 0} />
        <SummaryCard title="Clientes" value={data?.counts?.clientes ?? 0} />
        <SummaryCard title="Operadores" value={(data?.counts?.restaurantes ?? 0) + (data?.counts?.admins ?? 0)} />
      </div>

      {isLoading && !data ? <DashboardShellSkeleton /> : null}
      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      {!isLoading || data ? (
        <>
          <div className="hidden lg:block">
            <DesktopUsersTable
              data={data}
              filters={filters}
              isLoading={isLoading}
              ordering={ordering}
              onFilterChange={setFilters}
              onOrderingChange={toggleOrdering}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              onPageChange={setPage}
            />
          </div>
          <div className="lg:hidden">
            <MobileUsersList
              data={data}
              filters={filters}
              isLoading={isLoading}
              onFilterChange={setFilters}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              onPageChange={setPage}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}

function DesktopUsersTable({
  data,
  filters,
  isLoading,
  ordering,
  onFilterChange,
  onOrderingChange,
  pageSize,
  onPageSizeChange,
  onPageChange,
}) {
  return (
    <Card className="overflow-hidden">
      <div className="relative">
        <table className="w-full table-fixed">
          <thead className="bg-muted/70">
            <tr className="border-b border-border">
              {COLUMNS.map((column) => (
                <th key={column.key} className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                  <button type="button" onClick={() => onOrderingChange(column.key)} className="inline-flex items-center gap-2">
                    {column.label}
                    <OrderingIcon ordering={ordering} columnKey={column.key} />
                  </button>
                </th>
              ))}
            </tr>
            <tr className="border-b border-border bg-background">
              <th className="px-4 py-3">
                <FilterInput value={filters.name} onChange={(value) => onFilterChange((current) => ({ ...current, name: value }))} placeholder="Filtrar usuario" icon={<Search className="h-4 w-4" />} />
              </th>
              <th className="px-4 py-3">
                <FilterInput value={filters.email} onChange={(value) => onFilterChange((current) => ({ ...current, email: value }))} placeholder="Filtrar email" />
              </th>
              <th className="px-4 py-3">
                <FilterInput value={filters.phone} onChange={(value) => onFilterChange((current) => ({ ...current, phone: value }))} placeholder="Filtrar telefono" />
              </th>
              <th className="px-4 py-3">
                <Select value={filters.role} onValueChange={(value) => onFilterChange((current) => ({ ...current, role: value }))}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="restaurante">Restaurante</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </th>
              <th className="px-4 py-3">
                <Select value={filters.status} onValueChange={(value) => onFilterChange((current) => ({ ...current, status: value }))}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                    <SelectItem value="suspended">Suspendido</SelectItem>
                  </SelectContent>
                </Select>
              </th>
              <th className="px-4 py-3">
                <FilterInput value={filters.ordersCount} onChange={(value) => onFilterChange((current) => ({ ...current, ordersCount: value }))} placeholder="Ej. 3" />
              </th>
              <th className="px-4 py-3">
                <Input type="date" value={filters.joinedAt} onChange={(event) => onFilterChange((current) => ({ ...current, joinedAt: event.target.value }))} className="h-9" />
              </th>
            </tr>
          </thead>
          <tbody className={isLoading ? "opacity-35 transition-opacity" : "transition-opacity"}>
            {data?.results?.map((user) => {
              const roleMeta = ROLE_META[user.role] || ROLE_META.cliente
              const Icon = roleMeta.icon
              return (
                <tr key={user.id} className="border-b border-border/70 align-top last:border-b-0">
                  <td className="px-4 py-4 font-medium text-foreground">{user.name}</td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">{user.phone || "-"}</td>
                  <td className="px-4 py-4">
                    <Badge className={`gap-1 ${roleMeta.className}`}><Icon className="h-3.5 w-3.5" />{roleMeta.label}</Badge>
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">{STATUS_LABELS[user.status] || user.status_label}</td>
                  <td className="px-4 py-4 text-sm text-foreground">{user.orders_count}</td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">{new Date(user.joined_at).toLocaleDateString("es-CO")}</td>
                </tr>
              )
            })}
            {!isLoading && data?.results?.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">No se encontraron usuarios con esos filtros.</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        {isLoading ? <FilteringOverlay /> : null}
      </div>

      <PaginationFooter data={data} isLoading={isLoading} pageSize={pageSize} onPageSizeChange={onPageSizeChange} onPageChange={onPageChange} />
    </Card>
  )
}

function MobileUsersList({ data, filters, isLoading, onFilterChange, pageSize, onPageSizeChange, onPageChange }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <FilterInput value={filters.name} onChange={(value) => onFilterChange((current) => ({ ...current, name: value }))} placeholder="Usuario" icon={<Search className="h-4 w-4" />} />
          <FilterInput value={filters.email} onChange={(value) => onFilterChange((current) => ({ ...current, email: value }))} placeholder="Email" />
          <FilterInput value={filters.phone} onChange={(value) => onFilterChange((current) => ({ ...current, phone: value }))} placeholder="Telefono" />
          <FilterInput value={filters.ordersCount} onChange={(value) => onFilterChange((current) => ({ ...current, ordersCount: value }))} placeholder="Pedidos exactos" />
          <Select value={filters.role} onValueChange={(value) => onFilterChange((current) => ({ ...current, role: value }))}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Todos los roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los roles</SelectItem>
              <SelectItem value="cliente">Cliente</SelectItem>
              <SelectItem value="restaurante">Restaurante</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(value) => onFilterChange((current) => ({ ...current, status: value }))}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="inactive">Inactivo</SelectItem>
              <SelectItem value="suspended">Suspendido</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={filters.joinedAt} onChange={(event) => onFilterChange((current) => ({ ...current, joinedAt: event.target.value }))} className="sm:col-span-2" />
        </div>

        <div className="relative space-y-3">
          <div className={isLoading ? "space-y-3 opacity-35 transition-opacity" : "space-y-3 transition-opacity"}>
            {data?.results?.map((user) => {
              const roleMeta = ROLE_META[user.role] || ROLE_META.cliente
              const Icon = roleMeta.icon
              return (
                <div key={user.id} className="rounded-2xl border border-border/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <Badge className={`gap-1 ${roleMeta.className}`}><Icon className="h-3.5 w-3.5" />{roleMeta.label}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <MobileStat label="Telefono" value={user.phone || "-"} />
                    <MobileStat label="Estado" value={STATUS_LABELS[user.status] || user.status_label} />
                    <MobileStat label="Pedidos" value={String(user.orders_count)} />
                    <MobileStat label="Registro" value={new Date(user.joined_at).toLocaleDateString("es-CO")} />
                  </div>
                </div>
              )
            })}
            {!isLoading && data?.results?.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No se encontraron usuarios con esos filtros.</div> : null}
          </div>

          {isLoading ? <FilteringOverlay compact /> : null}
        </div>
      </CardContent>

      <PaginationFooter data={data} isLoading={isLoading} pageSize={pageSize} onPageSizeChange={onPageSizeChange} onPageChange={onPageChange} compact />
    </Card>
  )
}

function PaginationFooter({ data, isLoading, pageSize, onPageSizeChange, onPageChange, compact = false }) {
  return (
    <div className={`flex flex-col gap-4 border-t border-border p-4 ${compact ? "" : "md:flex-row md:items-center md:justify-between"}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <p className="text-sm text-muted-foreground">Pagina {data?.page ?? 1} de {data?.total_pages ?? 1}</p>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue placeholder={`${pageSize} por pagina`} />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>{option} por pagina</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" disabled={!data || data.page <= 1 || isLoading} onClick={() => onPageChange((current) => Math.max(current - 1, 1))}>Anterior</Button>
        <Button variant="outline" disabled={!data || data.page >= data.total_pages || isLoading} onClick={() => onPageChange((current) => current + 1)}>Siguiente</Button>
      </div>
    </div>
  )
}

function SummaryCard({ title, value }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent><p className="text-3xl font-bold text-foreground">{value}</p></CardContent>
    </Card>
  )
}

function FilterInput({ value, onChange, placeholder, icon = null }) {
  return (
    <div className="relative">
      {icon ? <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</div> : null}
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={icon ? "h-9 pl-9" : "h-9"} />
    </div>
  )
}

function OrderingIcon({ ordering, columnKey }) {
  if (ordering === columnKey) return <ChevronUp className="h-4 w-4" />
  if (ordering === `-${columnKey}`) return <ChevronDown className="h-4 w-4" />
  return <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
}

function FilteringOverlay({ compact = false }) {
  return (
    <div className={`absolute inset-x-0 bottom-0 flex items-center justify-center bg-background/35 backdrop-blur-[1px] ${compact ? "top-0 rounded-xl" : "top-[86px]"}`}>
      <div className="flex items-center gap-2 rounded-full bg-background/95 px-4 py-2 text-sm font-medium text-foreground shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Filtrando...
      </div>
    </div>
  )
}

function MobileStat({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
