from django.contrib import admin

from apps.customers.models import AddressType
from apps.customers.models import CustomerAddress
from apps.customers.models import CustomerPaymentMethod
from apps.customers.models import Favorite
from apps.customers.models import PaymentMethodType

admin.site.register(AddressType)
admin.site.register(CustomerAddress)
admin.site.register(CustomerPaymentMethod)
admin.site.register(Favorite)
admin.site.register(PaymentMethodType)
