from django.urls import path

from .api.views import LoginView
from .api.views import LogoutView
from .api.views import MeView
from .api.views import RefreshView
from .api.views import RegisterView

app_name = "custom_auth"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", RefreshView.as_view(), name="refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
]
