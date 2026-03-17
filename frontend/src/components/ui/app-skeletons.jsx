import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function AuthScreenSkeleton() {
  return (
    <div className="mx-auto flex min-h-[40vh] w-full max-w-5xl items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export function RestaurantGridSkeleton() {
  return (
    <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} className="overflow-hidden">
          <Skeleton className="aspect-video w-full rounded-none" />
          <CardContent className="space-y-4 p-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-6" />
            </div>
            <Skeleton className="h-4 w-44" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function RestaurantHeaderSkeleton() {
  return (
    <section className="border-b border-border bg-muted/30">
      <Skeleton className="h-48 w-full rounded-none md:h-64" />
      <div className="container mx-auto px-4">
        <div className="relative -mt-16 flex flex-col gap-4 md:flex-row md:items-end md:gap-6">
          <Skeleton className="h-32 w-32 rounded-xl border-4 border-background" />
          <div className="flex-1 space-y-3 pb-6">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-full max-w-2xl" />
            <Skeleton className="h-4 w-full max-w-xl" />
            <div className="flex flex-wrap gap-3 pt-2">
              <Skeleton className="h-10 w-48 rounded-lg" />
              <Skeleton className="h-10 w-40 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function RestaurantMenuSkeleton() {
  return (
    <div className="space-y-6">
      <div className="sticky top-16 z-40 -mx-4 bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Skeleton className="mb-4 h-7 w-24" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-24 rounded-full" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="flex gap-4 p-4">
              <Skeleton className="h-24 w-24 rounded-lg" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-full max-w-lg" />
                <Skeleton className="h-4 w-32" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function DashboardShellSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-44" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-2 pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-6 w-44" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((__, rowIndex) => (
                <div key={rowIndex} className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function ProfilePageSkeleton({ showBadge = false, showSecondaryMeta = false }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center py-8 text-center">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="mt-3 h-6 w-28" />
            {showSecondaryMeta ? <Skeleton className="mt-2 h-4 w-20" /> : null}
            <Skeleton className="mt-3 h-8 w-32 rounded-full" />
            {showBadge ? <Skeleton className="mt-3 h-6 w-36 rounded-full" /> : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <Skeleton className="h-10 w-36" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function OrdersListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="space-y-3 pb-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-4 w-52" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((__, rowIndex) => (
              <div key={rowIndex} className="flex items-center justify-between">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 flex-1" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function AddressListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-lg border border-border p-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function OwnerMenuSkeleton() {
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-4">
      <Card className="min-w-0 lg:col-span-1">
        <CardHeader>
          <Skeleton className="h-6 w-28" />
        </CardHeader>
        <CardContent className="min-w-0 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
      <div className="min-w-0 space-y-6 lg:col-span-3">
        <Skeleton className="h-10 w-full" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
                  <Skeleton className="h-16 w-16 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-5 w-40 max-w-full sm:w-48" />
                    <Skeleton className="h-4 w-full max-w-sm" />
                    <Skeleton className="h-4 w-28 max-w-full sm:w-32" />
                  </div>
                </div>
                <div className="flex w-full gap-2 sm:w-auto sm:gap-3">
                  <Skeleton className="h-8 w-20 sm:w-16" />
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

export function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="grid grid-cols-6 gap-4">
            <Skeleton className="col-span-2 h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
