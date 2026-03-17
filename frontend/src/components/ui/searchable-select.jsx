import { useMemo, useState } from "react"
import { Check, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export function SearchableSelect({
  options,
  value,
  selectedFallbackLabel,
  placeholder = "Seleccionar...",
  emptyMessage = "No se encontraron opciones",
  onCreate,
  onChange,
  onSearchChange,
  className,
  disabled = false,
  isLoading = false,
}) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  const selectedOption = options.find((option) => String(option.value) === String(value))
  const filteredOptions = useMemo(() => {
    if (onSearchChange) {
      return options
    }

    return options.filter((option) => option.label.toLowerCase().includes(searchValue.toLowerCase()))
  }, [onSearchChange, options, searchValue])

  const isSelectedValue = (optionValue) => String(optionValue) === String(value)

  const handleSelect = (selectedValue) => {
    onChange?.(isSelectedValue(selectedValue) ? "" : selectedValue)
    setOpen(false)
    setSearchValue("")
    onSearchChange?.("")
  }

  const handleSearchChange = (nextValue) => {
    setSearchValue(nextValue)
    onSearchChange?.(nextValue)
  }

  const handleCreate = async () => {
    if (!searchValue.trim() || !onCreate) {
      return
    }

    await onCreate(searchValue.trim())
    setSearchValue("")
    setOpen(false)
    onSearchChange?.("")
  }

  const showCreateOption =
    onCreate &&
    searchValue.trim() &&
    !filteredOptions.some((option) => option.label.toLowerCase() === searchValue.toLowerCase())

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", !selectedOption && "text-muted-foreground", className)}
          disabled={disabled}
        >
          {(selectedOption?.label ||
            (value !== "" && value !== null && value !== undefined ? selectedFallbackLabel : "")) ||
            placeholder}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={!onSearchChange}>
          <CommandInput placeholder="Buscar..." value={searchValue} onValueChange={handleSearchChange} />
          <CommandList>
            {isLoading ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 p-4 text-sm">
                <Spinner className="h-4 w-4" />
                <span>Cargando...</span>
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {showCreateOption ? (
                    <div className="flex items-center justify-center p-2">
                      <Button variant="ghost" size="sm" onClick={handleCreate} className="w-full justify-start">
                        <Plus className="mr-2 h-4 w-4" />
                        Crear "{searchValue}"
                      </Button>
                    </div>
                  ) : (
                    emptyMessage
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {filteredOptions.map((option) => (
                    <CommandItem key={option.value} value={option.label} onSelect={() => handleSelect(option.value)}>
                      <Check className={cn("mr-2 h-4 w-4", isSelectedValue(option.value) ? "opacity-100" : "opacity-0")} />
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
