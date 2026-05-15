from django.urls import path

from apps.order_chat.api.views import OrderChatImageView
from apps.order_chat.api.views import OrderChatMessagesView
from apps.order_chat.api.views import OrderChatReadView
from apps.order_chat.api.views import OrderChatView
from apps.order_chat.api.views import OrderContactInfoView
from apps.order_chat.api.views import PlatformChatConfigView

urlpatterns = [
    path("orders/<uuid:order_id>/contact-info/", OrderContactInfoView.as_view()),
    path("orders/<uuid:order_id>/chat/", OrderChatView.as_view()),
    path("orders/<uuid:order_id>/chat/messages/", OrderChatMessagesView.as_view()),
    path("orders/<uuid:order_id>/chat/read/", OrderChatReadView.as_view()),
    path("orders/chat/messages/<uuid:message_id>/image/", OrderChatImageView.as_view()),
    path("platform/chat-config/", PlatformChatConfigView.as_view()),
]
