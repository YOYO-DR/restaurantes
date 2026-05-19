import { useAuth } from "@/context/auth-context"
import { Outlet } from "react-router-dom"
import { AdminSidebar } from "@/components/dashboard/admin/admin-sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"

export function AdminLayout() {
  const { user, activeRole } = useAuth()

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardHeader userName={user?.name || "Admin FoodHub"} userType={activeRole === "cliente" ? "cliente" : "admin"} />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/60 [&::-webkit-scrollbar-thumb:hover]:bg-border [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
