from django.contrib import admin

from apps.accounts.models import ActionCatalog
from apps.accounts.models import LegalDocument
from apps.accounts.models import LegalDocumentType
from apps.accounts.models import Role
from apps.accounts.models import RoleActionPermission
from apps.accounts.models import UserLegalAcceptance
from apps.accounts.models import UserProfile
from apps.accounts.models import UserRole
from apps.accounts.models import UserSession
from apps.accounts.models import UserStatus

admin.site.register(ActionCatalog)
admin.site.register(LegalDocument)
admin.site.register(LegalDocumentType)
admin.site.register(Role)
admin.site.register(RoleActionPermission)
admin.site.register(UserLegalAcceptance)
admin.site.register(UserProfile)
admin.site.register(UserRole)
admin.site.register(UserSession)
admin.site.register(UserStatus)
