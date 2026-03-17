import { useAuth } from "@/context/auth-context"
import { Outlet } from "react-router-dom"
import { AdminSidebar } from "@/components/dashboard/admin/admin-sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"

export function AdminLayout() {
  const { user } = useAuth()

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-background">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardHeader userName={user?.name || "Admin FoodHub"} userType="admin" />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
