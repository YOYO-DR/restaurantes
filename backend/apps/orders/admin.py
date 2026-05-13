from django.contrib import admin

from apps.orders.models import Order
from apps.orders.models import OrderFulfillment
from apps.orders.models import OrderItem
from apps.orders.models import OrderPaymentTransaction
from apps.orders.models import OrderStatus
from apps.orders.models import OrderStatusHistory
from apps.orders.models import OrderType
from apps.orders.models import PaymentStatus

admin.site.register(Order)
admin.site.register(OrderFulfillment)
admin.site.register(OrderItem)
admin.site.register(OrderPaymentTransaction)
admin.site.register(OrderStatus)
admin.site.register(OrderStatusHistory)
admin.site.register(OrderType)
admin.site.register(PaymentStatus)
