import { useMemo, useState } from "react"
import { toast } from "sonner"
import { DashboardShellSkeleton } from "@/components/ui/app-skeletons"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useOwnerReviews } from "@/hooks/use-orders"
import { Clock, Loader2, MessageCircle, Send, Star, TrendingUp } from "lucide-react"

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function ReviewsList({ reviews, replyingTo, replyText, setReplyingTo, setReplyText, onReply, isReplying }) {
  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="space-y-4 rounded-lg border border-border p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary/10 text-primary">{getInitials(review.customer_name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{review.customer_name}</p>
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} className={`h-3 w-3 ${index < review.rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(review.date)}</span>
                </div>
              </div>
            </div>
            {review.responded ? (
              <Badge variant="secondary" className="text-green-600">Respondida</Badge>
            ) : (
              <Badge variant="outline" className="text-amber-600">Pendiente</Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground">{review.comment || "Sin comentario"}</p>

          {review.order_items?.length ? (
            <div className="flex flex-wrap gap-2">
              {review.order_items.map((item) => (
                <Badge key={item} variant="outline" className="text-xs">{item}</Badge>
              ))}
            </div>
          ) : null}

          {review.responded && review.response ? (
            <div className="ml-6 rounded-lg bg-muted p-3">
              <p className="mb-1 text-xs font-medium text-primary">Tu respuesta:</p>
              <p className="text-sm">{review.response}</p>
            </div>
          ) : null}

          {!review.responded ? (
            replyingTo === review.id ? (
              <div className="ml-6 space-y-2">
                <Textarea placeholder="Escribe tu respuesta..." value={replyText} onChange={(event) => setReplyText(event.target.value)} rows={3} />
                <div className="flex gap-2">
                  <Button size="sm" disabled={!replyText.trim() || isReplying} onClick={() => onReply(review.id)}>
                    {isReplying ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />}
                    Enviar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setReplyingTo(null)
                    setReplyText("")
                  }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setReplyingTo(review.id)}>
                <MessageCircle className="mr-2 h-3 w-3" />
                Responder
              </Button>
            )
          ) : null}
        </div>
      ))}
      {reviews.length === 0 ? <p className="text-sm text-muted-foreground">No hay resenas en esta seccion.</p> : null}
    </div>
  )
}

export default function ResenasRestaurantePage() {
  const { data, isLoading, isReplying, error, replyReview } = useOwnerReviews()
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState("")

  const pendingReviews = useMemo(
    () => data.reviews.filter((review) => !review.responded),
    [data.reviews],
  )
  const respondedReviews = useMemo(
    () => data.reviews.filter((review) => review.responded),
    [data.reviews],
  )

  if (isLoading) {
    return <DashboardShellSkeleton />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Resenas</h1>
        <p className="text-muted-foreground">Gestiona las opiniones reales de tus clientes</p>
      </div>

      {error ? <div className="text-sm text-destructive">{error}</div> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500/10">
                <Star className="h-6 w-6 fill-yellow-500 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Calificacion</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-bold">{data.metrics.average_rating}</p>
                  <span className="text-sm text-muted-foreground">/ 5</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <MessageCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total resenas</p>
                <p className="text-2xl font-bold">{data.metrics.total_reviews}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Este mes</p>
                <p className="text-2xl font-bold">{data.metrics.this_month}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/20">
                <Clock className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sin responder</p>
                <p className="text-2xl font-bold">{data.metrics.pending_replies}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Distribucion de calificaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.distribution.map((item) => (
              <div key={item.rating} className="flex items-center gap-3">
                <div className="flex w-12 items-center gap-1">
                  <span className="text-sm font-medium">{item.rating}</span>
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                </div>
                <Progress value={item.percentage} className="h-2 flex-1" />
                <span className="w-10 text-right text-sm text-muted-foreground">{item.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Resenas recientes</CardTitle>
            <CardDescription>Responde a tus clientes y mejora tu reputacion</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList className="mb-4">
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="pending">
                  Sin responder
                  {pendingReviews.length > 0 ? <Badge variant="secondary" className="ml-2">{pendingReviews.length}</Badge> : null}
                </TabsTrigger>
                <TabsTrigger value="responded">Respondidas</TabsTrigger>
              </TabsList>

              <TabsContent value="all">
                <ReviewsList
                  reviews={data.reviews}
                  replyingTo={replyingTo}
                  replyText={replyText}
                  setReplyingTo={setReplyingTo}
                  setReplyText={setReplyText}
                  isReplying={isReplying}
                  onReply={async (reviewId) => {
                    try {
                      await replyReview(reviewId, replyText)
                      toast.success("Respuesta enviada")
                      setReplyingTo(null)
                      setReplyText("")
                    } catch (replyError) {
                      toast.error(replyError.message || "No fue posible responder la resena")
                    }
                  }}
                />
              </TabsContent>

              <TabsContent value="pending">
                <ReviewsList
                  reviews={pendingReviews}
                  replyingTo={replyingTo}
                  replyText={replyText}
                  setReplyingTo={setReplyingTo}
                  setReplyText={setReplyText}
                  isReplying={isReplying}
                  onReply={async (reviewId) => {
                    try {
                      await replyReview(reviewId, replyText)
                      toast.success("Respuesta enviada")
                      setReplyingTo(null)
                      setReplyText("")
                    } catch (replyError) {
                      toast.error(replyError.message || "No fue posible responder la resena")
                    }
                  }}
                />
              </TabsContent>

              <TabsContent value="responded">
                <ReviewsList
                  reviews={respondedReviews}
                  replyingTo={replyingTo}
                  replyText={replyText}
                  setReplyingTo={setReplyingTo}
                  setReplyText={setReplyText}
                  isReplying={isReplying}
                  onReply={async (reviewId) => {
                    try {
                      await replyReview(reviewId, replyText)
                      toast.success("Respuesta enviada")
                      setReplyingTo(null)
                      setReplyText("")
                    } catch (replyError) {
                      toast.error(replyError.message || "No fue posible responder la resena")
                    }
                  }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
