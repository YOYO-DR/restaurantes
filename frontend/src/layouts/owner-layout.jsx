import { useState } from "react"
import { useAuth } from "@/context/auth-context"
import { OwnerOrdersProvider } from "@/context/owner-orders-context"
import { Outlet } from "react-router-dom"
import { OwnerSidebar } from "@/components/dashboard/owner/owner-sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { Sheet, SheetContent } from "@/components/ui/sheet"

export function OwnerLayout() {
  const { user } = useAuth()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <OwnerOrdersProvider>
      <div className="flex min-h-screen w-full overflow-x-hidden">
        <OwnerSidebar className="hidden lg:flex" />
        <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
          <DashboardHeader
            userName={user?.name || "Dueno FoodHub"}
            userType="dueno"
            onMobileMenuClick={() => setIsSidebarOpen(true)}
          />
          <main className="min-w-0 flex-1 overflow-x-hidden bg-muted/30 p-4 sm:p-6">
            <Outlet />
          </main>
        </div>

        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetContent side="left" className="w-[18rem] p-0 sm:max-w-none lg:hidden">
            <OwnerSidebar className="w-full border-r-0" onNavigate={() => setIsSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </OwnerOrdersProvider>
  )
}
