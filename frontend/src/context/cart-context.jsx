import { createContext, useContext, useMemo, useState } from "react"

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, setItems] = useState([])
  const [restaurant, setRestaurant] = useState(null)
  const [orderType, setOrderType] = useState("delivery")
  const [tableNumber, setTableNumber] = useState("")
  const [tableId, setTableId] = useState("")

  const addItem = (item, restaurantPayload = null) => {
    setItems((currentItems) => {
      if (restaurantPayload && restaurant && restaurant.id !== restaurantPayload.id) {
        setRestaurant(restaurantPayload)
        return [{ ...item, quantity: 1 }]
      }

      const existingItem = currentItems.find((currentItem) => currentItem.id === item.id)

      if (existingItem) {
        return currentItems.map((currentItem) =>
          currentItem.id === item.id
            ? { ...currentItem, quantity: currentItem.quantity + 1 }
            : currentItem,
        )
      }

      return [...currentItems, { ...item, quantity: 1 }]
    })

    if (restaurantPayload && (!restaurant || restaurant.id !== restaurantPayload.id)) {
      setRestaurant(restaurantPayload)
    }
  }

  const updateQuantity = (id, delta) => {
    setItems((currentItems) =>
      currentItems
        .map((item) =>
          item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item,
        )
        .filter((item) => item.quantity > 0),
    )
  }

  const removeItem = (id) => {
    setItems((currentItems) => currentItems.filter((item) => item.id !== id))
  }

  const clearCart = () => {
    setItems([])
    setRestaurant(null)
    setOrderType("delivery")
    setTableNumber("")
    setTableId("")
  }

  const value = useMemo(
    () => ({
      items,
      restaurant,
      orderType,
      tableNumber,
      tableId,
      setOrderType,
      setTableNumber,
      setTableId,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    }),
    [items, orderType, restaurant, tableId, tableNumber],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart must be used within CartProvider")
  }
  return context
}
