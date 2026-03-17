import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, SlidersHorizontal } from "lucide-react"

export function RestaurantFilters({ categories, activeCategory, search, onCategoryChange, onSearchChange }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar restaurantes..."
            className="pl-10"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <Button variant="outline" className="w-full sm:w-auto" disabled>
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Filtros
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Button
            key={category}
            variant={activeCategory === category ? "default" : "outline"}
            size="sm"
            onClick={() => onCategoryChange(category)}
            className="rounded-full"
          >
            {category}
          </Button>
        ))}
      </div>
    </div>
  )
}
