import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Eye, EyeOff, Loader2, Utensils } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { acceptOperatorInvitation, getOperatorInvitation } from "@/services/restaurants"

const schema = z
  .object({
    name: z.string().min(2, "Ingresa tu nombre completo"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    password_confirm: z.string().min(8, "Confirma tu contraseña"),
  })
  .refine((d) => d.password === d.password_confirm, {
    path: ["password_confirm"],
    message: "Las contraseñas no coinciden",
  })

export default function InvitacionOperadorPage() {
  const { token } = useParams()

  const [invitation, setInvitation] = useState(null)
  const [loadError, setLoadError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [accepted, setAccepted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState("")

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!token || token.length < 10) {
      setLoadError("El enlace de invitación no es válido.")
      setIsLoading(false)
      return
    }
    getOperatorInvitation(token)
      .then(setInvitation)
      .catch((err) => setLoadError(err.message || "Esta invitación no es válida o ya expiró."))
      .finally(() => setIsLoading(false))
  }, [token])

  const onSubmit = async (values) => {
    setServerError("")
    try {
      await acceptOperatorInvitation(token, {
        name: values.name,
        password: values.password,
        password_confirm: values.password_confirm,
      })
      setAccepted(true)
    } catch (err) {
      setServerError(err.message || "No fue posible aceptar la invitación")
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Utensils className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">FoodHub</span>
        </div>

        <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && loadError && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-destructive">{loadError}</p>
              <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Volver al inicio
              </Link>
            </div>
          )}

          {!isLoading && !loadError && accepted && (
            <div className="space-y-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mx-auto">
                <Utensils className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold">¡Cuenta creada!</h2>
              <p className="text-sm text-muted-foreground">
                Ya formas parte de <strong>{invitation?.restaurant_name}</strong>. Inicia sesión para comenzar.
              </p>
              <Button asChild className="w-full">
                <Link to="/login">Iniciar sesión</Link>
              </Button>
            </div>
          )}

          {!isLoading && !loadError && !accepted && invitation && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">Únete a {invitation.restaurant_name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Has sido invitado como operador. Completa tu registro para continuar.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input
                    id="name"
                    placeholder="Juan Pérez"
                    aria-invalid={errors.name ? "true" : "false"}
                    {...register("name")}
                  />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="********"
                      aria-invalid={errors.password ? "true" : "false"}
                      {...register("password")}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password_confirm">Confirmar contraseña</Label>
                  <Input
                    id="password_confirm"
                    type="password"
                    placeholder="********"
                    aria-invalid={errors.password_confirm ? "true" : "false"}
                    {...register("password_confirm")}
                  />
                  {errors.password_confirm && (
                    <p className="text-sm text-destructive">{errors.password_confirm.message}</p>
                  )}
                </div>

                {serverError && (
                  <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {serverError}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando cuenta...
                    </>
                  ) : (
                    "Crear cuenta y aceptar"
                  )}
                </Button>
              </form>

              <p className="text-center text-xs text-muted-foreground">
                Este enlace expira el{" "}
                {new Date(invitation.expires_at).toLocaleDateString("es-CO", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
