import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import App from '@/App'
import { AuthProvider } from '@/context/auth-context'
import { CartProvider } from '@/context/cart-context'
import { NotificationCenterProvider } from '@/context/notification-center-context'
import { ThemeProvider } from '@/context/theme-context'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <NotificationCenterProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </NotificationCenterProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
