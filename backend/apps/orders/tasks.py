import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 3, "countdown": 10},
)
def send_order_confirmation_email_task(self, order_id: str) -> None:
    from apps.orders.models import Order
    from apps.orders.services import send_order_confirmation_email

    logger.info("Enviando confirmacion de pedido para order_id=%s", order_id)
    order = Order.objects.select_related("restaurant").prefetch_related("items").get(id=order_id)
    send_order_confirmation_email(order)
    logger.info("Confirmacion de pedido enviada para order_code=%s", order.order_code)
