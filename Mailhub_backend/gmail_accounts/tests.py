from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from gmail_accounts.models import GmailAccount
from gmail_accounts.services.crypto_service import decrypt_token, encrypt_token
from gmail_accounts.services.message_parser import (
    decode_base64_url,
    extract_headers,
    parse_full_message,
)
from gmail_accounts.services.oauth_service import (
    generate_authorization_url,
    verify_state_token,
)

User = get_user_model()


class CryptoAndParserTests(APITestCase):
    def test_token_encryption_and_decryption(self):
        raw_token = "ya29.a0AfH6SMB_secret_access_token_12345"
        encrypted = encrypt_token(raw_token)
        self.assertNotEqual(raw_token, encrypted)
        decrypted = decrypt_token(encrypted)
        self.assertEqual(raw_token, decrypted)

    def test_state_token_generation_and_verification(self):
        user_id = 42
        url, state = generate_authorization_url(user_id)
        self.assertTrue(url.startswith("https://accounts.google.com/o/oauth2/auth"))
        self.assertIn("client_id", url)
        self.assertIn("state=", url)

        verified_id, verifier = verify_state_token(state)
        self.assertEqual(verified_id, user_id)
        self.assertIsNotNone(verifier)

    def test_message_parser_headers_and_body(self):
        dummy_message = {
            "id": "msg_001",
            "threadId": "thread_001",
            "labelIds": ["INBOX", "STARRED"],
            "snippet": "Hello this is a test snippet",
            "payload": {
                "headers": [
                    {"name": "Subject", "value": "Test Subject"},
                    {"name": "From", "value": "sender@example.com"},
                    {"name": "To", "value": "recipient@example.com"},
                    {"name": "Date", "value": "Wed, 28 Oct 2026 10:00:00 +0000"},
                ],
                "parts": [
                    {
                        "mimeType": "text/plain",
                        "body": {"data": "SGVsbG8gV29ybGQ="},  # "Hello World" in base64
                    }
                ],
            },
        }
        parsed = parse_full_message(dummy_message)
        self.assertEqual(parsed["id"], "msg_001")
        self.assertEqual(parsed["subject"], "Test Subject")
        self.assertEqual(parsed["from"], "sender@example.com")
        self.assertEqual(parsed["body_text"], "Hello World")
        self.assertTrue(parsed["is_read"])
        self.assertTrue(parsed["is_starred"])
        self.assertFalse(parsed["is_trashed"])


class GmailAccountPermissionTests(APITestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            email="user1@example.com",
            password="Password123!",
            role=User.Role.USER,
        )
        self.user2 = User.objects.create_user(
            email="user2@example.com",
            password="Password123!",
            role=User.Role.USER,
        )
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="AdminPassword123!",
            role=User.Role.ADMIN,
        )

        # Create Gmail accounts for user1 and user2
        self.acc1 = GmailAccount.objects.create(
            user=self.user1,
            email_address="user1.personal@gmail.com",
            access_token=encrypt_token("token_user1"),
            refresh_token=encrypt_token("refresh_user1"),
            is_active=True,
        )
        self.acc2 = GmailAccount.objects.create(
            user=self.user2,
            email_address="user2.work@gmail.com",
            access_token=encrypt_token("token_user2"),
            refresh_token=encrypt_token("refresh_user2"),
            is_active=True,
        )

    def test_normal_user_sees_only_own_accounts(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse("gmail-account-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only see acc1
        emails = [a["email_address"] for a in response.data]
        self.assertIn("user1.personal@gmail.com", emails)
        self.assertNotIn("user2.work@gmail.com", emails)

    def test_normal_user_cannot_access_another_users_account(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse("gmail-account-detail", kwargs={"pk": self.acc2.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_user_sees_all_connected_accounts(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse("gmail-account-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        emails = [a["email_address"] for a in response.data]
        self.assertIn("user1.personal@gmail.com", emails)
        self.assertIn("user2.work@gmail.com", emails)

    def test_admin_can_access_any_users_account(self):
        self.client.force_authenticate(user=self.admin)
        # Admin accesses user1's account
        url = reverse("gmail-account-detail", kwargs={"pk": self.acc1.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email_address"], "user1.personal@gmail.com")

        # Admin accesses user2's account
        url = reverse("gmail-account-detail", kwargs={"pk": self.acc2.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email_address"], "user2.work@gmail.com")

    def test_admin_overview_endpoint(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse("admin-gmail-overview")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        stats = response.data["stats"]
        self.assertEqual(stats["total_connected_accounts"], 2)
        self.assertEqual(stats["total_users"], 3)
        self.assertEqual(stats["admin_users"], 1)
        self.assertEqual(stats["normal_users"], 2)

    def test_admin_overview_forbidden_for_normal_user(self):
        self.client.force_authenticate(user=self.user1)
        url = reverse("admin-gmail-overview")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
