import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, Loader2, Store, User } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useAuth } from "@/context/auth-context"
import { dashboardPathByRole } from "@/lib/auth-routing"

const registerSchema = z
  .object({
    userType: z.enum(["cliente", "dueno"]),
    firstName: z.string().min(2, "Ingresa un nombre valido"),
    lastName: z.string().min(2, "Ingresa un apellido valido"),
    email: z.string().email("Ingresa un correo valido"),
    phone: z.string().min(7, "Ingresa un telefono valido"),
    password: z.string().min(8, "La contrasena debe tener minimo 8 caracteres"),
    confirmPassword: z.string().min(8, "Confirma la contrasena"),
    restaurantName: z.string().optional(),
    restaurantAddress: z.string().optional(),
    acceptTerms: z.boolean().refine((value) => value, {
      message: "Debes aceptar terminos y politica de privacidad",
    }),
  })
  .superRefine((data, context) => {
    if (data.password !== data.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Las contrasenas no coinciden",
      })
    }

    if (data.userType === "dueno") {
      if (!data.restaurantName || data.restaurantName.trim().length < 2) {
        context.addIssue({
          code: "custom",
          path: ["restaurantName"],
          message: "Ingresa un nombre de restaurante valido",
        })
      }
      if (!data.restaurantAddress || data.restaurantAddress.trim().length < 5) {
        context.addIssue({
          code: "custom",
          path: ["restaurantAddress"],
          message: "Ingresa una direccion valida",
        })
      }
    }
  })

export function RegisterForm() {
  const navigate = useNavigate()
  const { register: registerUser } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState("")

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      userType: "cliente",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      restaurantName: "",
      restaurantAddress: "",
      acceptTerms: false,
    },
  })

  const userType = watch("userType")
  const acceptTerms = watch("acceptTerms")

  const onSubmit = async (values) => {
    setServerError("")
    const payload = {
      email: values.email,
      name: `${values.firstName} ${values.lastName}`.trim(),
      phone: values.phone,
      password: values.password,
      password_confirm: values.confirmPassword,
      user_type: values.userType,
      restaurant_name: values.restaurantName,
      restaurant_address: values.restaurantAddress,
    }

    try {
      const user = await registerUser(payload)
      toast.success("Cuenta creada con exito")
      navigate(dashboardPathByRole(user.role), { replace: true })
    } catch (error) {
      const message = error.message || "No fue posible crear la cuenta"
      setServerError(message)
      toast.error(message)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
      <div className="space-y-4">
        <div className="space-y-3">
          <Label>Tipo de cuenta</Label>
          <RadioGroup
            value={userType}
            onValueChange={(value) => {
              setValue("userType", value, { shouldValidate: true })
            }}
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <RadioGroupItem value="cliente" id="cliente" className="peer sr-only" />
              <Label
                htmlFor="cliente"
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-border p-4 hover:bg-muted peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
              >
                <User className="mb-2 h-6 w-6" />
                <span className="font-medium">Cliente</span>
                <span className="mt-1 text-center text-xs text-muted-foreground">
                  Haz pedidos en restaurantes
                </span>
              </Label>
            </div>
            <div>
              <RadioGroupItem value="dueno" id="dueno" className="peer sr-only" />
              <Label
                htmlFor="dueno"
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-border p-4 hover:bg-muted peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
              >
                <Store className="mb-2 h-6 w-6" />
                <span className="font-medium">Dueno</span>
                <span className="mt-1 text-center text-xs text-muted-foreground">
                  Registra tu restaurante
                </span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">Nombre</Label>
            <Input
              id="firstName"
              placeholder="Juan"
              aria-invalid={errors.firstName ? "true" : "false"}
              {...register("firstName")}
            />
            {errors.firstName ? <p className="text-sm text-destructive">{errors.firstName.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Apellido</Label>
            <Input
              id="lastName"
              placeholder="Perez"
              aria-invalid={errors.lastName ? "true" : "false"}
              {...register("lastName")}
            />
            {errors.lastName ? <p className="text-sm text-destructive">{errors.lastName.message}</p> : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Correo electronico</Label>
          <Input
            id="email"
            type="email"
            placeholder="correo@ejemplo.com"
            aria-invalid={errors.email ? "true" : "false"}
            {...register("email")}
          />
          {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefono</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+57 312 345 6789"
            aria-invalid={errors.phone ? "true" : "false"}
            {...register("phone")}
          />
          {errors.phone ? <p className="text-sm text-destructive">{errors.phone.message}</p> : null}
        </div>

        {userType === "dueno" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="restaurantName">Nombre del restaurante</Label>
              <Input
                id="restaurantName"
                placeholder="Mi Restaurante"
                aria-invalid={errors.restaurantName ? "true" : "false"}
                {...register("restaurantName")}
              />
              {errors.restaurantName ? (
                <p className="text-sm text-destructive">{errors.restaurantName.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="restaurantAddress">Direccion del restaurante</Label>
                <Input
                  id="restaurantAddress"
                  placeholder="Calle 1 #2-34, Ciudad"
                  aria-invalid={errors.restaurantAddress ? "true" : "false"}
                  {...register("restaurantAddress")}
                />
              {errors.restaurantAddress ? (
                <p className="text-sm text-destructive">{errors.restaurantAddress.message}</p>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="password">Contrasena</Label>
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
          {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar contrasena</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="********"
            aria-invalid={errors.confirmPassword ? "true" : "false"}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
          ) : null}
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="terms"
            checked={acceptTerms}
            onCheckedChange={(checked) => {
              setValue("acceptTerms", Boolean(checked), { shouldValidate: true })
            }}
            required
          />
          <Label htmlFor="terms" className="text-sm font-normal leading-relaxed">
            Acepto los <a href="#" className="text-primary hover:underline">terminos de servicio</a> y la{" "}
            <a href="#" className="text-primary hover:underline">politica de privacidad</a>
          </Label>
        </div>
        {errors.acceptTerms ? <p className="text-sm text-destructive">{errors.acceptTerms.message}</p> : null}

        {serverError ? (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || !acceptTerms}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creando cuenta...
          </>
        ) : (
          "Crear cuenta"
        )}
      </Button>
    </form>
  )
}
