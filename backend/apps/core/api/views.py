from django.core.exceptions import ImproperlyConfigured
from rest_framework.viewsets import ModelViewSet

from apps.core.permissions import IsAuthenticatedUser


class AbstractModelViewSet(ModelViewSet):
    permission_classes = [IsAuthenticatedUser]

    def get_queryset(self):
        if self.queryset is None:
            msg = "AbstractModelViewSet requires a queryset on subclasses."
            raise ImproperlyConfigured(msg)
        return super().get_queryset()
