import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { formatCurrency } from "@/lib/format"
import { LoyaltyDiscountBadge } from "./loyalty-discount-badge"
import { Coins } from "lucide-react"

export function LoyaltyDirectRedemption({
  items,
  loyaltyData,
  lineRedemptionPoints,
  setLineRedemptionPoints,
}) {
  const currentPoints = Number(loyaltyData?.current_points || 0)
  const pointRedeemValue = Number(loyaltyData?.point_redeem_value || 0)
  const maxPerOrder = loyaltyData?.max_redeemable_points_per_order
    ? Number(loyaltyData.max_redeemable_points_per_order)
    : null
  const maxBalance = loyaltyData?.max_customer_points_balance
    ? Number(loyaltyData.max_customer_points_balance)
    : null

  const globalCap = maxPerOrder != null
    ? Math.min(maxPerOrder, currentPoints)
    : currentPoints

  const totalLinePoints = Object.values(lineRedemptionPoints).reduce(
    (acc, v) => acc + Number(v || 0),
    0,
  )
  const totalDiscount = totalLinePoints * pointRedeemValue

  const isAtCap = maxBalance != null && currentPoints >= maxBalance

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" />
          <span>
            Tienes <strong>{currentPoints}</strong> pts
            {pointRedeemValue > 0
              ? ` · 1 pt = ${formatCurrency(pointRedeemValue)}`
              : ""}
          </span>
        </div>
        {maxPerOrder != null ? (
          <span className="text-xs text-muted-foreground">Máx {maxPerOrder} pts/pedido</span>
        ) : null}
      </div>

      {isAtCap ? (
        <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Estás en el tope de puntos. Aplícalos aquí para liberar saldo y seguir acumulando.
        </p>
      ) : null}

      {totalLinePoints > 0 ? (
        <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <div className="space-y-0.5">
            <div className="text-xs text-muted-foreground">
              {totalLinePoints} / {globalCap} pts aplicados
            </div>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min((totalLinePoints / globalCap) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Descuento total</p>
            <p className="font-semibold text-primary">−{formatCurrency(totalDiscount)}</p>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {items.map((item, index) => {
          const allows = Boolean(item.allows_points_redemption)
          const minPoints = Number(item.min_points_redeemable || 0)
          const lineTotal = item.price * item.quantity
          const maxByPrice = pointRedeemValue > 0
            ? Math.floor(lineTotal / pointRedeemValue)
            : 0
          const rawMax = item.max_points_redeemable != null
            ? Number(item.max_points_redeemable)
            : null
          const itemCap = rawMax != null ? Math.min(rawMax, maxByPrice) : maxByPrice
          const currentItemPoints = Number(lineRedemptionPoints[index] || 0)
          const otherPoints = totalLinePoints - currentItemPoints
          const maxForThisItem = Math.min(itemCap, Math.max(globalCap - otherPoints, 0))

          if (!allows) {
            return (
              <div key={`${item.id}-${index}`} className="flex items-center justify-between rounded-md border border-dashed border-border px-3 py-2 text-sm opacity-60">
                <span>{item.name}</span>
                <span className="text-xs text-muted-foreground">No admite canje</span>
              </div>
            )
          }

          return (
            <div key={`${item.id}-${index}`} className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {currentItemPoints > 0 ? (
                      <>
                        <span className="line-through">{formatCurrency(lineTotal)}</span>
                        {" → "}
                        <span className="font-medium text-foreground">
                          {formatCurrency(Math.max(lineTotal - currentItemPoints * pointRedeemValue, 0))}
                        </span>
                      </>
                    ) : (
                      formatCurrency(lineTotal)
                    )}
                    {" · "}
                    Min {minPoints} / Máx {maxForThisItem} pts
                  </p>
                </div>
                <LoyaltyDiscountBadge
                  points={currentItemPoints}
                  pointValue={pointRedeemValue}
                  lineTotal={lineTotal}
                />
              </div>
              <div className="flex items-center gap-3">
                <Slider
                  min={0}
                  max={maxForThisItem}
                  step={1}
                  value={[currentItemPoints]}
                  onValueChange={([val]) => {
                    setLineRedemptionPoints((prev) => ({ ...prev, [index]: val }))
                  }}
                  className="flex-1"
                  disabled={maxForThisItem <= 0}
                />
                <Input
                  type="number"
                  min={0}
                  max={maxForThisItem}
                  value={currentItemPoints}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(Number(e.target.value || 0), maxForThisItem))
                    setLineRedemptionPoints((prev) => ({ ...prev, [index]: val }))
                  }}
                  className="w-20 text-center text-sm"
                  disabled={maxForThisItem <= 0}
                />
              </div>
              {currentItemPoints > 0 && currentItemPoints < minPoints ? (
                <p className="text-xs text-destructive">
                  Mínimo {minPoints} puntos para este producto (o 0 para no aplicar).
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
