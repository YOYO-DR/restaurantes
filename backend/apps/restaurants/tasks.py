import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={"max_retries": 3, "countdown": 10},
)
def send_operator_invitation_email_task(self, invitation_id: str) -> None:
    from apps.restaurants.models import OperatorInvitation
    from apps.restaurants.services import send_operator_invitation_email

    logger.info("Enviando invitacion de operador para invitation_id=%s", invitation_id)
    invitation = OperatorInvitation.objects.select_related("restaurant", "invited_by").get(
        id=invitation_id
    )
    send_operator_invitation_email(invitation)
    logger.info("Invitacion enviada a %s", invitation.email)
