export function formatCurrency(value, currency = "COP") {
  const numericValue = Number(value || 0)

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(numericValue)
}

export function formatDeliveryWindow(minMinutes, maxMinutes) {
  if (!minMinutes && !maxMinutes) {
    return "Sin tiempo estimado"
  }

  if (minMinutes && maxMinutes) {
    return `${minMinutes}-${maxMinutes} min`
  }

  return `${minMinutes || maxMinutes} min`
}
