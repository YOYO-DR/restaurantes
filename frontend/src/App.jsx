import { Suspense, lazy } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { DashboardShellSkeleton } from "@/components/ui/app-skeletons"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { PublicOnlyRoute } from "@/components/auth/public-only-route"
import { AuthSessionProvider } from "@/components/auth/auth-session-provider"
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications"
import { NotificationCenterProvider } from "@/context/notification-center-context"
import { PublicLayout } from "@/layouts/public-layout"
import { AdminLayout } from "@/layouts/admin-layout"
import { ClientLayout } from "@/layouts/client-layout"
import { OwnerLayout } from "@/layouts/owner-layout"
import HomePage from "@/pages/home"
import LoginPage from "@/pages/login"
import RegisterPage from "@/pages/registro"
import RestaurantesPage from "@/pages/restaurantes"
import RestaurantPage from "@/pages/restaurantes/[slug]"
import ServiciosPage from "@/pages/servicios"
import PreciosPage from "@/pages/precios"
import CheckoutPage from "@/pages/checkout"
import GuestOrdersPage from "@/pages/mis-pedidos"
import RecuperarContrasenaPage from "@/pages/recuperar-contrasena"
import AdminDashboard from "@/pages/dashboard/admin"
import AdminUsers from "@/pages/dashboard/admin/usuarios"
import AdminRestaurants from "@/pages/dashboard/admin/restaurantes"
import AdminReports from "@/pages/dashboard/admin/reportes"
import AdminSettings from "@/pages/dashboard/admin/configuracion"
import AdminFuncionalidades from "@/pages/dashboard/admin/funcionalidades"
import AdminPlanes from "@/pages/dashboard/admin/planes"
import AdminSolicitudes from "@/pages/dashboard/admin/solicitudes"
import ClientDashboardPage from "@/pages/dashboard/cliente"
import ClientOrdersPage from "@/pages/dashboard/cliente/pedidos"
import ClientPointsPage from "@/pages/dashboard/cliente/puntos"
import ClientAddressesPage from "@/pages/dashboard/cliente/direcciones"
import ClientFavoritesPage from "@/pages/dashboard/cliente/favoritos"
import ClientProfilePage from "@/pages/dashboard/cliente/perfil"
import ClienteConfiguracionPage from "@/pages/dashboard/cliente/configuracion"
import OwnerDashboardPage from "@/pages/dashboard/restaurante"
import OwnerOrdersPage from "@/pages/dashboard/restaurante/pedidos"
import OwnerMenuPage from "@/pages/dashboard/restaurante/menu"
import OwnerInventoryPage from "@/pages/dashboard/restaurante/inventario"
import OwnerClientsPage from "@/pages/dashboard/restaurante/clientes"
import OwnerReviewsPage from "@/pages/dashboard/restaurante/resenas"
import OwnerAnalyticsPage from "@/pages/dashboard/restaurante/analiticas"
import OwnerLoyaltyPage from "@/pages/dashboard/restaurante/lealtad"
import OwnerProfilePage from "@/pages/dashboard/restaurante/perfil"
import OwnerSettingsPage from "@/pages/dashboard/restaurante/configuracion"
import OwnerOperadoresPage from "@/pages/dashboard/restaurante/operadores"
import OwnerSuscripcionPage from "@/pages/dashboard/restaurante/suscripcion"
import InvitacionOperadorPage from "@/pages/invitacion-operador"
import NotFoundPage from "@/pages/not-found"

const OwnerQrPage = lazy(() => import("@/pages/dashboard/restaurante/qr"))
const OwnerCustomizationPage = lazy(() => import("@/pages/dashboard/restaurante/personalizacion"))

function RealtimeBootstrap() {
  useRealtimeNotifications()
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <NotificationCenterProvider>
        <AuthSessionProvider>
          <RealtimeBootstrap />
          <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <LoginPage />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/registro"
              element={
                <PublicOnlyRoute>
                  <RegisterPage />
                </PublicOnlyRoute>
              }
            />
            <Route path="/restaurantes" element={<RestaurantesPage />} />
            <Route path="/restaurantes/:slug" element={<RestaurantPage />} />
            <Route path="/servicios" element={<ServiciosPage />} />
            <Route path="/precios" element={<PreciosPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/mis-pedidos" element={<GuestOrdersPage />} />
            <Route path="/recuperar-contrasena" element={<RecuperarContrasenaPage />} />
            <Route path="/invitacion-operador/:token" element={<InvitacionOperadorPage />} />
          </Route>

          <Route
            path="/dashboard/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="usuarios" element={<AdminUsers />} />
            <Route path="restaurantes" element={<AdminRestaurants />} />
            <Route path="reportes" element={<AdminReports />} />
            <Route path="configuracion" element={<AdminSettings />} />
            <Route path="funcionalidades" element={<AdminFuncionalidades />} />
            <Route path="planes" element={<AdminPlanes />} />
            <Route path="solicitudes" element={<AdminSolicitudes />} />
            <Route path="perfil" element={<Navigate to="/dashboard/admin/configuracion" replace />} />
          </Route>

          <Route path="/admin" element={<Navigate to="/dashboard/admin" replace />} />

          <Route
            path="/dashboard/cliente"
            element={
              <ProtectedRoute allowedRoles={["cliente"]}>
                <ClientLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ClientDashboardPage />} />
            <Route path="pedidos" element={<ClientOrdersPage />} />
            <Route path="puntos" element={<ClientPointsPage />} />
            <Route path="direcciones" element={<ClientAddressesPage />} />
            <Route path="favoritos" element={<ClientFavoritesPage />} />
            <Route path="perfil" element={<ClientProfilePage />} />
            <Route path="configuracion" element={<ClienteConfiguracionPage />} />
          </Route>

          <Route
            path="/dashboard/restaurante"
            element={
              <ProtectedRoute allowedRoles={["restaurante", "dueno", "operador"]}>
                <OwnerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<OwnerDashboardPage />} />
            <Route path="pedidos" element={<OwnerOrdersPage />} />
            <Route path="menu" element={<OwnerMenuPage />} />
            <Route path="inventario" element={<OwnerInventoryPage />} />
            <Route path="clientes" element={<OwnerClientsPage />} />
            <Route path="resenas" element={<OwnerReviewsPage />} />
            <Route path="analiticas" element={<OwnerAnalyticsPage />} />
            <Route path="lealtad" element={<OwnerLoyaltyPage />} />
            <Route path="qr" element={<Suspense fallback={<DashboardShellSkeleton />}><OwnerQrPage /></Suspense>} />
            <Route path="personalizacion" element={<Suspense fallback={<DashboardShellSkeleton />}><OwnerCustomizationPage /></Suspense>} />
            <Route
              path="operadores"
              element={
                <ProtectedRoute allowedRoles={["restaurante", "dueno"]}>
                  <OwnerOperadoresPage />
                </ProtectedRoute>
              }
            />
            <Route path="perfil" element={<OwnerProfilePage />} />
            <Route path="configuracion" element={<OwnerSettingsPage />} />
            <Route
              path="suscripcion"
              element={
                <ProtectedRoute allowedRoles={["restaurante", "dueno"]}>
                  <OwnerSuscripcionPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthSessionProvider>
        <Toaster position="top-left" richColors />
      </NotificationCenterProvider>
    </BrowserRouter>
  )
}
