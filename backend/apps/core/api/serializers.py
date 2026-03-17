from rest_framework import serializers


class AbstractModelSerializer(serializers.ModelSerializer):
    class Meta:
        abstract = True
        fields = "__all__"
