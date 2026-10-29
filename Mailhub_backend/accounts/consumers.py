import json
import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User

logger = logging.getLogger(__name__)


class UserEventConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time user-specific and system events.

    Connection URL:
        ws://<host>/ws/events/?token=<jwt_access_token>

    Each connected client joins:
        1. "user_<user_id>" - for direct events sent to this specific user.
        2. "admin_channel"  - if the connected user has an admin role.
    """

    async def connect(self):
        query_string = self.scope.get("query_string", b"").decode("utf-8")
        params = parse_qs(query_string)
        token_list = params.get("token")

        if not token_list or not token_list[0]:
            logger.warning("WebSocket connection rejected: Missing JWT token.")
            await self.close(code=4001)
            return

        token_str = token_list[0]
        user = await self.get_user_from_token(token_str)

        if not user:
            logger.warning("WebSocket connection rejected: Invalid or expired JWT token.")
            await self.close(code=4002)
            return

        self.user = user
        self.user_group_name = f"user_{user.id}"

        # Join personal user group
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name,
        )

        # If user is admin, also join admin group
        if getattr(user, "is_admin", False):
            await self.channel_layer.group_add(
                "admin_channel",
                self.channel_name,
            )

        await self.accept()

        # Send welcome/connection established packet
        await self.send(
            text_data=json.dumps(
                {
                    "type": "CONNECTION_ESTABLISHED",
                    "user_id": user.id,
                    "email": user.email,
                    "role": user.role,
                    "message": f"Real-time event stream connected for {user.email}.",
                }
            )
        )
        logger.info(f"WebSocket connected for user {user.email} (id={user.id}).")

    async def disconnect(self, close_code):
        if hasattr(self, "user_group_name"):
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name,
            )
        if hasattr(self, "user") and getattr(self.user, "is_admin", False):
            await self.channel_layer.group_discard(
                "admin_channel",
                self.channel_name,
            )
        if hasattr(self, "user"):
            logger.info(f"WebSocket disconnected for user {self.user.email} (code={close_code}).")

    async def receive(self, text_data=None, bytes_data=None):
        """Handle incoming messages from client (e.g. heartbeat ping or get_image)."""
        if not text_data:
            return
        try:
            data = json.loads(text_data)
            msg_type = str(data.get("type", "")).upper()
            if msg_type == "PING":
                await self.send(text_data=json.dumps({"type": "PONG"}))
            elif msg_type in ("GET_IMAGE", "STOP_GET_IMAGE"):
                # Pure JSON data event, zero image URLs
                target_user_id = data.get("target_user_id")
                action = str(data.get("action", "START")).upper()
                is_stop = (msg_type == "STOP_GET_IMAGE") or (action == "STOP")

                event_type = "STOP_GET_IMAGE" if is_stop else "GET_IMAGE"
                title = data.get("title") or ("Stop Image Event" if is_stop else "Get Image Event")
                message = data.get("message") or (
                    f"Stop receiving image stream for user {target_user_id or getattr(self.user, 'id', 0)}."
                    if is_stop
                    else f"Start receiving image stream for user {target_user_id or getattr(self.user, 'id', 0)} (JSON data only)."
                )

                payload = {
                    "type": "IMAGE_EVENT",
                    "event_type": event_type,
                    "action": "STOP" if is_stop else "START",
                    "status": "stopped" if is_stop else "active",
                    "title": title,
                    "message": message,
                    "data": {
                        "stream_active": not is_stop,
                        "session_id": f"img_stream_{target_user_id or getattr(self.user, 'id', 0)}",
                        "format": "json_only",
                        "target_user_id": target_user_id,
                        **(data.get("data") if isinstance(data.get("data"), dict) else {}),
                    },
                    "sender": {
                        "id": getattr(self.user, "id", 0) if hasattr(self, "user") else 0,
                        "email": getattr(self.user, "email", "WebSocket Server") if hasattr(self, "user") else "WebSocket Server",
                    },
                    "timestamp": timezone.now().isoformat(),
                }

                # If an admin is targeting a specific user, route exclusively to that user's channel group
                if target_user_id and getattr(self.user, "is_admin", False):
                    target_group = f"user_{target_user_id}"
                    await self.channel_layer.group_send(
                        target_group,
                        {
                            "type": "user_event",
                            "payload": payload,
                        },
                    )
                    logger.info(f"Admin {getattr(self.user, 'email', 'admin')} dispatched {event_type} to {target_group} (JSON only)")
                else:
                    await self.send(text_data=json.dumps(payload))
        except Exception as e:
            logger.debug(f"Error handling incoming WebSocket message: {e}")

    async def user_event(self, event):
        """
        Handler for user events sent through channel_layer.group_send:
        await channel_layer.group_send(
            f"user_{user_id}",
            {
                "type": "user_event",
                "payload": { ... }
            }
        )
        """
        payload = event.get("payload", {})
        await self.send(text_data=json.dumps(payload))

    @database_sync_to_async
    def get_user_from_token(self, token_str):
        try:
            access_token = AccessToken(token_str)
            user_id = access_token.get("user_id")
            if not user_id:
                return None
            return User.objects.filter(id=user_id, is_active=True).first()
        except (TokenError, InvalidToken, Exception) as e:
            logger.debug(f"JWT validation failed: {e}")
            return None
