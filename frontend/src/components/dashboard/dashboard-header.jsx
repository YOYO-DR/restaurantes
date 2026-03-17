import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Settings, LogOut, User, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useAuth } from "@/context/auth-context";
export function DashboardHeader({ userName, userType, onMobileMenuClick }) {
    const { logout } = useAuth();
    const initials = userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase();
    const dashboardPath = userType === "admin"
        ? "/dashboard/admin"
        : userType === "dueno"
            ? "/dashboard/restaurante"
            : "/dashboard/cliente";
    return (<header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        {onMobileMenuClick ? (<Button
            variant="ghost"
            size="icon"
            className="size-9 lg:hidden"
            onClick={onMobileMenuClick}
          >
            <Menu className="h-5 w-5"/>
            <span className="sr-only">Abrir menu</span>
          </Button>) : null}

        <h1 className="truncate text-base font-semibold sm:text-lg">
          {userType === "cliente" && "Mi Cuenta"}
          {userType === "dueno" && "Mi Restaurante"}
          {userType === "admin" && "Administracion"}
        </h1>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 md:gap-4">
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5"/>
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
            3
          </span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{userName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {userType === "cliente" && "Cliente"}
                  {userType === "dueno" && "Dueno de restaurante"}
                  {userType === "admin" && "Administrador"}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to={`${dashboardPath}/perfil`}>
                <User className="mr-2 h-4 w-4"/>
                <span>Mi perfil</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`${dashboardPath}/configuracion`}>
                <Settings className="mr-2 h-4 w-4"/>
                <span>Configuracion</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                    await logout();
                }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4"/>
              <span>Cerrar sesion</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>);
}
