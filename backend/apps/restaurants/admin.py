from django.contrib import admin

from apps.restaurants.models import CartPosition
from apps.restaurants.models import CategoryNavigationStyle
from apps.restaurants.models import MenuLayoutOption
from apps.restaurants.models import QrCode
from apps.restaurants.models import QrTargetType
from apps.restaurants.models import Restaurant
from apps.restaurants.models import RestaurantAddress
from apps.restaurants.models import RestaurantBranding
from apps.restaurants.models import RestaurantCategory
from apps.restaurants.models import RestaurantDeliverySetting
from apps.restaurants.models import RestaurantHour
from apps.restaurants.models import RestaurantOrderCapability
from apps.restaurants.models import RestaurantPaymentSetting
from apps.restaurants.models import RestaurantSocialLink
from apps.restaurants.models import RestaurantStatus
from apps.restaurants.models import RestaurantTable
from apps.restaurants.models import TableStatus


admin.site.register(CartPosition)
admin.site.register(CategoryNavigationStyle)
admin.site.register(MenuLayoutOption)
admin.site.register(QrCode)
admin.site.register(QrTargetType)
admin.site.register(Restaurant)
admin.site.register(RestaurantAddress)
admin.site.register(RestaurantBranding)
admin.site.register(RestaurantCategory)
admin.site.register(RestaurantDeliverySetting)
admin.site.register(RestaurantHour)
admin.site.register(RestaurantOrderCapability)
admin.site.register(RestaurantPaymentSetting)
admin.site.register(RestaurantSocialLink)
admin.site.register(RestaurantStatus)
admin.site.register(RestaurantTable)
admin.site.register(TableStatus)
