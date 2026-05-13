from django.contrib import admin

from apps.loyalty.models import LoyaltyAccount
from apps.loyalty.models import LoyaltyRedemption
from apps.loyalty.models import LoyaltyRedemptionStatus
from apps.loyalty.models import LoyaltyReward
from apps.loyalty.models import LoyaltyTier
from apps.loyalty.models import LoyaltyTransaction
from apps.loyalty.models import LoyaltyTransactionType

admin.site.register(LoyaltyAccount)
admin.site.register(LoyaltyRedemption)
admin.site.register(LoyaltyRedemptionStatus)
admin.site.register(LoyaltyReward)
admin.site.register(LoyaltyTier)
admin.site.register(LoyaltyTransaction)
admin.site.register(LoyaltyTransactionType)
