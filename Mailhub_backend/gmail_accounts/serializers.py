from rest_framework import serializers
from accounts.serializers import UserSerializer
from .models import EmailCache, GmailAccount


class GmailAccountSerializer(serializers.ModelSerializer):
    """
    Public serializer for connected Gmail accounts.
    Never exposes raw or encrypted tokens.
    Includes user details so admins can see which user owns each account.
    """
    user = UserSerializer(read_only=True)
    is_token_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = GmailAccount
        fields = [
            "id",
            "user",
            "email_address",
            "google_account_id",
            "is_active",
            "token_expiry",
            "is_token_expired",
            "scopes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "google_account_id",
            "token_expiry",
            "is_token_expired",
            "scopes",
            "created_at",
            "updated_at",
        ]


class EmailListQuerySerializer(serializers.Serializer):
    """Query parameter serializer for message listing."""
    folder = serializers.ChoiceField(
        choices=["inbox", "sent", "drafts", "trash", "spam", "starred", "important", "all"],
        default="inbox",
        required=False,
    )
    q = serializers.CharField(required=False, allow_blank=True, default="")
    page_token = serializers.CharField(required=False, allow_blank=True, default=None)
    max_results = serializers.IntegerField(required=False, default=20, min_value=1, max_value=50)


class EmailSendSerializer(serializers.Serializer):
    """Payload for composing and sending a new email."""
    to = serializers.ListField(
        child=serializers.EmailField(),
        allow_empty=False,
        required=True,
    )
    subject = serializers.CharField(required=True, max_length=998)
    body_text = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    body_html = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    cc = serializers.ListField(
        child=serializers.EmailField(),
        required=False,
        default=list,
    )
    bcc = serializers.ListField(
        child=serializers.EmailField(),
        required=False,
        default=list,
    )
    thread_id = serializers.CharField(required=False, allow_blank=True, allow_null=True, default=None)

    def validate(self, attrs):
        if not attrs.get("body_text") and not attrs.get("body_html"):
            raise serializers.ValidationError("Either body_text or body_html must be provided.")
        return attrs


class EmailReplySerializer(serializers.Serializer):
    """Payload for replying to an existing email."""
    body_text = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    body_html = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    cc = serializers.ListField(
        child=serializers.EmailField(),
        required=False,
        default=list,
    )
    bcc = serializers.ListField(
        child=serializers.EmailField(),
        required=False,
        default=list,
    )
    reply_all = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        if not attrs.get("body_text") and not attrs.get("body_html"):
            raise serializers.ValidationError("Either body_text or body_html must be provided.")
        return attrs


class EmailForwardSerializer(serializers.Serializer):
    """Payload for forwarding an existing email."""
    to = serializers.ListField(
        child=serializers.EmailField(),
        allow_empty=False,
        required=True,
    )
    subject = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    body_text = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    body_html = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    cc = serializers.ListField(
        child=serializers.EmailField(),
        required=False,
        default=list,
    )
    bcc = serializers.ListField(
        child=serializers.EmailField(),
        required=False,
        default=list,
    )


class ModifyLabelsSerializer(serializers.Serializer):
    """Payload for adding or removing labels from an email."""
    add_labels = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    remove_labels = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )


class EmailCacheSerializer(serializers.ModelSerializer):
    """Serializer for cached email metadata."""
    class Meta:
        model = EmailCache
        fields = "__all__"
