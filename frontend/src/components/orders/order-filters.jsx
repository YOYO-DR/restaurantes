import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, X } from "lucide-react"

const ORDER_TYPE_OPTIONS = [
  { value: "all", label: "Todos los tipos" },
  { value: "delivery", label: "Domicilio" },
  { value: "pickup", label: "Recogida" },
  { value: "table", label: "Mesa" },
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function offsetDays(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function startOfWeek() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

function startOfMonth() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

const DATE_PRESETS_CUSTOMER = [
  { label: "Hoy", from: () => todayStr(), to: () => todayStr() },
  { label: "Esta semana", from: startOfWeek, to: todayStr },
  { label: "Este mes", from: startOfMonth, to: todayStr },
]

const DATE_PRESETS_OWNER = [
  { label: "Hoy", from: () => todayStr(), to: () => todayStr() },
  { label: "Ayer", from: () => offsetDays(-1), to: () => offsetDays(-1) },
  { label: "Esta semana", from: startOfWeek, to: todayStr },
  { label: "Este mes", from: startOfMonth, to: todayStr },
]

// Detecta qué preset activo coincide con el rango actual
function activePreset(presets, dateFrom, dateTo) {
  for (const p of presets) {
    if (p.from() === dateFrom && p.to() === dateTo) return p.label
  }
  return null
}

function hasActiveFilters(filters) {
  return Boolean(filters.q || filters.order_type || filters.date_from || filters.date_to)
}

export function OrderFilters({ filters, setFilters, variant = "customer" }) {
  const presets = variant === "owner" ? DATE_PRESETS_OWNER : DATE_PRESETS_CUSTOMER
  const searchPlaceholder = variant === "owner"
    ? "Buscar por cliente, código o teléfono…"
    : "Buscar por restaurante o código…"

  const [inputValue, setInputValue] = useState(filters.q || "")
  const debounceRef = useRef(null)

  // Debounce texto de búsqueda (400 ms)
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setFilters((prev) => {
        if ((prev.q || "") === inputValue) {
          return prev
        }
        return { ...prev, q: inputValue }
      })
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [inputValue, setFilters])

  // Sincronizar si se borra desde fuera (clear all)
  useEffect(() => {
    if (filters.q === "" && inputValue !== "") {
      setInputValue("")
    }
  }, [filters.q])

  const currentPreset = activePreset(presets, filters.date_from, filters.date_to)
  const active = hasActiveFilters(filters)

  function setDatePreset(preset) {
    setFilters((prev) => ({
      ...prev,
      date_from: preset.from(),
      date_to: preset.to(),
    }))
  }

  function clearDateRange() {
    setFilters((prev) => ({ ...prev, date_from: "", date_to: "" }))
  }

  function clearAll() {
    setInputValue("")
    setFilters({ q: "", order_type: "", date_from: "", date_to: "" })
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/20 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Búsqueda */}
        <div className="relative min-w-0 flex-1" style={{ minWidth: "180px" }}>
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 pr-3 text-sm"
            placeholder={searchPlaceholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          {inputValue ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => { setInputValue(""); setFilters((p) => ({ ...p, q: "" })) }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {/* Tipo de pedido */}
        <Select
          value={filters.order_type || "all"}
          onValueChange={(v) => setFilters((prev) => ({ ...prev, order_type: v === "all" ? "" : v }))}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            {ORDER_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Botón limpiar todo */}
        {active ? (
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs text-muted-foreground" onClick={clearAll}>
            <X className="h-3.5 w-3.5" />
            Limpiar
          </Button>
        ) : null}
      </div>

      {/* Presets de fecha + indicador del rango activo */}
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant={currentPreset === preset.label ? "default" : "outline"}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => currentPreset === preset.label ? clearDateRange() : setDatePreset(preset)}
          >
            {preset.label}
          </Button>
        ))}
        {filters.date_from && filters.date_to && !currentPreset ? (
          <Badge variant="secondary" className="flex items-center gap-1 text-xs">
            {filters.date_from} → {filters.date_to}
            <button type="button" onClick={clearDateRange} className="ml-1 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ) : null}
        {filters.date_from && !filters.date_to && !currentPreset ? (
          <Badge variant="secondary" className="text-xs">Desde {filters.date_from}</Badge>
        ) : null}
      </div>
    </div>
  )
}
