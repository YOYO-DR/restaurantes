import { useEffect, useState } from "react"
import { toast } from "sonner"
import { apiJson } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CheckCircle, XCircle, Clock } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const BASE = "/api/admin/billing/plan-change-requests"

const STATUS_COLORS = {
  pending: "default",
  approved: "outline",
  rejected: "secondary",
  superseded: "outline",
}

const STATUS_LABELS = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  superseded: "Supersedida",
}

function RequestCard({ req, onDecision }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 py-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{req.restaurant_name}</p>
            <Badge variant={STATUS_COLORS[req.status]}>{STATUS_LABELS[req.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {req.current_plan_name} → <span className="font-medium text-foreground">{req.requested_plan_name}</span>
            {" "}· {req.request_type === "upgrade" ? "Upgrade" : "Downgrade"}
          </p>
          {req.notes && <p className="text-sm italic text-muted-foreground">"{req.notes}"</p>}
          <p className="text-xs text-muted-foreground">
            Solicitado por {req.requested_by_name || "—"} el{" "}
            {new Date(req.created_at).toLocaleDateString("es-CO")}
          </p>
          {req.decided_by_name && (
            <p className="text-xs text-muted-foreground">
              Decidido por {req.decided_by_name}
              {req.decided_at && ` el ${new Date(req.decided_at).toLocaleDateString("es-CO")}`}
            </p>
          )}
        </div>
        {req.status === "pending" && (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" onClick={() => onDecision(req, "approve")}>
              <CheckCircle className="mr-1.5 h-4 w-4" />Aprobar
            </Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => onDecision(req, "reject")}>
              <XCircle className="mr-1.5 h-4 w-4" />Rechazar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function AdminSolicitudesPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("pending")
  const [decision, setDecision] = useState(null) // { req, action }
  const [notes, setNotes] = useState("")
  const [deciding, setDeciding] = useState(false)

  const load = async (status = statusFilter) => {
    setLoading(true)
    try {
      const data = await apiJson(`${BASE}/?status=${status}`)
      setRequests(data?.results ?? data)
    } catch {
      toast.error("Error al cargar solicitudes")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [statusFilter])

  const handleDecision = async () => {
    if (!decision) return
    setDeciding(true)
    try {
      const updated = await apiJson(`${BASE}/${decision.req.id}/${decision.action}/`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      })
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      toast.success(decision.action === "approve" ? "Solicitud aprobada" : "Solicitud rechazada")
      setDecision(null)
      setNotes("")
    } catch (err) {
      toast.error(err?.detail ?? "Error al procesar la solicitud")
    } finally {
      setDeciding(false)
    }
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Solicitudes de cambio de plan</h1>
          <p className="text-sm text-muted-foreground">Aprueba o rechaza las solicitudes de los propietarios</p>
        </div>
        {pendingCount > 0 && (
          <Badge className="text-sm px-3 py-1">
            <Clock className="mr-1.5 h-4 w-4" />
            {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Label className="shrink-0">Filtrar por:</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="approved">Aprobadas</SelectItem>
            <SelectItem value="rejected">Rechazadas</SelectItem>
            <SelectItem value="superseded">Supersedidas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : requests.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No hay solicitudes {STATUS_LABELS[statusFilter]?.toLowerCase()}s</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <RequestCard key={r.id} req={r} onDecision={(req, action) => { setDecision({ req, action }); setNotes("") }} />
          ))}
        </div>
      )}

      <Dialog open={!!decision} onOpenChange={(open) => { if (!open) setDecision(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision?.action === "approve" ? "Aprobar solicitud" : "Rechazar solicitud"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {decision?.req.restaurant_name} — {decision?.req.current_plan_name} → {decision?.req.requested_plan_name}
            </p>
            <div className="space-y-1">
              <Label>Notas (opcional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Agrega un comentario…" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>Cancelar</Button>
            <Button
              onClick={handleDecision}
              disabled={deciding}
              variant={decision?.action === "reject" ? "destructive" : "default"}
            >
              {deciding ? "Procesando…" : decision?.action === "approve" ? "Aprobar" : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
