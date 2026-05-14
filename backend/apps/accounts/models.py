from django.conf import settings
from django.db import models

from apps.core.models import BaseCatalogModel
from apps.core.models import BaseModel


class Role(BaseCatalogModel):
    description = models.TextField(blank=True)


class UserStatus(BaseCatalogModel):
    description = models.TextField(blank=True)


class UserRole(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="account_roles",
    )
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name="users")
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_account_roles",
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounts_user_roles"
        constraints = [
            models.UniqueConstraint(
                fields=("user", "role"),
                name="uniq_accounts_user_role",
            ),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.role.name}"


class UserProfile(BaseModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    status = models.ForeignKey(
        UserStatus,
        on_delete=models.PROTECT,
        related_name="profiles",
    )
    phone = models.CharField(max_length=30, blank=True)
    avatar_url = models.URLField(blank=True)
    avatar_file = models.FileField(upload_to="user-avatars/", blank=True)
    preferred_language = models.CharField(max_length=20, blank=True)

    class Meta:
        db_table = "accounts_user_profiles"


class UserSession(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sessions",
    )
    refresh_token_hash = models.CharField(max_length=255, unique=True)
    device_name = models.CharField(max_length=120, blank=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True)
    city = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=120, blank=True)
    is_current = models.BooleanField(default=False)
    last_seen_at = models.DateTimeField()
    expires_at = models.DateTimeField()

    class Meta:
        db_table = "accounts_user_sessions"
        indexes = [models.Index(fields=("user", "last_seen_at"))]


class LegalDocumentType(BaseCatalogModel):
    description = models.TextField(blank=True)


class LegalDocument(BaseModel):
    doc_type = models.ForeignKey(
        LegalDocumentType,
        on_delete=models.PROTECT,
        related_name="documents",
    )
    version = models.CharField(max_length=30)
    published_at = models.DateTimeField()
    url = models.URLField()

    class Meta:
        db_table = "accounts_legal_documents"
        constraints = [
            models.UniqueConstraint(
                fields=("doc_type", "version"),
                name="uniq_accounts_doc_type_version",
            ),
        ]


class UserLegalAcceptance(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="legal_acceptances",
    )
    legal_document = models.ForeignKey(
        LegalDocument,
        on_delete=models.PROTECT,
        related_name="acceptances",
    )
    accepted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounts_user_legal_acceptances"
        constraints = [
            models.UniqueConstraint(
                fields=("user", "legal_document"),
                name="uniq_accounts_user_legal_acceptance",
            ),
        ]


class ActionCatalog(BaseCatalogModel):
    domain = models.CharField(max_length=80)
    description = models.TextField(blank=True)


class RoleActionPermission(BaseModel):
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="action_permissions",
    )
    action = models.ForeignKey(
        ActionCatalog,
        on_delete=models.CASCADE,
        related_name="role_permissions",
    )
    is_allowed = models.BooleanField(default=True)

    class Meta:
        db_table = "accounts_role_action_permissions"
        constraints = [
            models.UniqueConstraint(
                fields=("role", "action"),
                name="uniq_accounts_role_action_permission",
            ),
        ]
