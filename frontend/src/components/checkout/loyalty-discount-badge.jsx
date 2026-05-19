import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Info } from "lucide-react"
import { formatCurrency } from "@/lib/format"

function getBadgeTone(percent) {
  if (percent <= 0) return null
  if (percent >= 100) return { label: "GRATIS", emoji: "🎁", class: "border-purple-400 text-purple-700 bg-purple-50" }
  if (percent >= 70) return { label: `-${percent}%`, emoji: "💎", class: "border-yellow-500 text-yellow-700 bg-yellow-50" }
  if (percent >= 35) return { label: `-${percent}%`, emoji: "🔥", class: "border-orange-400 text-orange-700 bg-orange-50" }
  if (percent >= 15) return { label: `-${percent}%`, emoji: "⬇️", class: "border-emerald-400 text-emerald-700 bg-emerald-50" }
  return { label: `-${percent}%`, emoji: "", class: "border-gray-300 text-gray-600 bg-gray-50" }
}

export function LoyaltyDiscountBadge({ points, pointValue, lineTotal }) {
  const pointsNum = Number(points || 0)
  const pointValueNum = Number(pointValue || 0)
  const lineTotalNum = Number(lineTotal || 0)

  if (pointsNum <= 0 || pointValueNum <= 0 || lineTotalNum <= 0) return null

  const discountAmount = pointsNum * pointValueNum
  const percent = Math.round((discountAmount / lineTotalNum) * 100)
  const tone = getBadgeTone(percent)
  if (!tone) return null

  return (
    <Badge variant="outline" className={`shrink-0 gap-1 text-xs font-semibold ${tone.class}`}>
      {tone.emoji ? <span>{tone.emoji}</span> : null}
      <span>{tone.label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Detalle del descuento" className="hover:opacity-70">
            <Info className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="max-w-xs text-xs leading-relaxed">
          Aplicando {pointsNum} pts → {formatCurrency(discountAmount)} de descuento ({percent}% del producto)
        </PopoverContent>
      </Popover>
    </Badge>
  )
}
