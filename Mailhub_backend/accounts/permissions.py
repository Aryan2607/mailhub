from rest_framework import permissions


class IsAdminUserRole(permissions.BasePermission):
    """
    Allows access only to users with role=ADMIN or is_staff/is_superuser.
    """

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "is_admin", False)
        )


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Object-level permission:
    - Admin users can access, view, edit, trash, restore, and delete any resource.
    - Normal users can only access resources they own.
    """

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False

        # Admin role or staff has full permission
        if getattr(request.user, "is_admin", False):
            return True

        # Check ownership: obj may be a GmailAccount or have a .user attribute
        if hasattr(obj, "user"):
            return obj.user == request.user
        elif hasattr(obj, "gmail_account"):
            return obj.gmail_account.user == request.user

        return False
