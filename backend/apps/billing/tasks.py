from celery import shared_task
from django.db import transaction
from django.utils import timezone


@shared_task(name="billing.expire_trials")
def expire_trials_task():
    from apps.billing.models import RestaurantSubscription
    from apps.billing.services.subscriptions import expire_trial

    expired_ids = list(
        RestaurantSubscription.objects.filter(
            status=RestaurantSubscription.STATUS_TRIAL,
            trial_end__lt=timezone.now(),
        ).values_list("pk", flat=True)
    )

    count = 0
    for sub_pk in expired_ids:
        with transaction.atomic():
            try:
                sub = RestaurantSubscription.objects.select_for_update(nowait=True).get(
                    pk=sub_pk,
                    status=RestaurantSubscription.STATUS_TRIAL,
                    trial_end__lt=timezone.now(),
                )
            except RestaurantSubscription.DoesNotExist:
                continue
            except Exception:
                continue
            expire_trial(sub.restaurant)
            count += 1
    return {"expired": count}


@shared_task(name="billing.process_scheduled_downgrades")
def process_scheduled_downgrades_task():
    from apps.billing.models import RestaurantSubscription
    from apps.billing.services.subscriptions import downgrade_to_free

    due_ids = list(
        RestaurantSubscription.objects.filter(
            cancelled_at__isnull=False,
            current_period_end__lt=timezone.now(),
            status=RestaurantSubscription.STATUS_ACTIVE,
        ).values_list("pk", flat=True)
    )

    count = 0
    for sub_pk in due_ids:
        with transaction.atomic():
            try:
                sub = RestaurantSubscription.objects.select_for_update(nowait=True).get(
                    pk=sub_pk,
                    cancelled_at__isnull=False,
                    current_period_end__lt=timezone.now(),
                    status=RestaurantSubscription.STATUS_ACTIVE,
                )
            except RestaurantSubscription.DoesNotExist:
                continue
            except Exception:
                continue
            downgrade_to_free(sub.restaurant)
            count += 1
    return {"downgraded": count}
