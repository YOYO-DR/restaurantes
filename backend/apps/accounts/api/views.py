from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.accounts.api.serializers import AccountProfileSerializer


class AccountProfileViewSet(GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AccountProfileSerializer

    def list(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    def partial_update(self, request, pk=None):
        serializer = self.get_serializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(self.get_serializer(request.user).data)
