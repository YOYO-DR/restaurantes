import pytest
from celery.result import EagerResult

from apps.users.models import User
from apps.users.tasks import get_users_count
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def test_user_count(settings):
    """A basic test to execute the get_users_count Celery task."""
    initial_count = User.objects.count()
    batch_size = 3
    UserFactory.create_batch(batch_size)
    settings.CELERY_TASK_ALWAYS_EAGER = True
    task_result = get_users_count.delay()
    assert isinstance(task_result, EagerResult)
    assert task_result.result == initial_count + batch_size
