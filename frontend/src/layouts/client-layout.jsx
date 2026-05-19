import { useState } from "react"
import { useAuth } from "@/context/auth-context"
import { Outlet } from "react-router-dom"
import { ClientSidebar } from "@/components/dashboard/client/client-sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Sheet, SheetContent } from "@/components/ui/sheet"

export function ClientLayout() {
  const { user, activeRole } = useAuth()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <ClientSidebar className="sticky top-0 hidden h-screen self-start lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <DashboardHeader
          userName={user?.name || "Cliente FoodHub"}
          userType={activeRole === "admin" ? "admin" : activeRole === "restaurante" ? "dueno" : "cliente"}
          onMobileMenuClick={() => setIsSidebarOpen(true)}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-muted/30 p-4 sm:p-6 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/60 [&::-webkit-scrollbar-thumb:hover]:bg-border [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2">
          <Outlet />
        </main>
      </div>

      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetContent side="left" className="w-[18rem] p-0 sm:max-w-none lg:hidden">
          <ClientSidebar className="w-full border-r-0" onNavigate={() => setIsSidebarOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
