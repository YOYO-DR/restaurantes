import uuid

from django.db import models


class BaseModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class BaseSoftDeleteModel(BaseModel):
    deleted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        abstract = True


class BaseCatalogModel(BaseModel):
    code = models.CharField(max_length=60, unique=True)
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)

    class Meta:
        abstract = True
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name
