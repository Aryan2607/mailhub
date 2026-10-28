from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class AccountsAuthTests(APITestCase):
    def setUp(self):
        self.normal_user = User.objects.create_user(
            email="user@example.com",
            password="StrongPassword123!",
            first_name="Normal",
            last_name="User",
            role=User.Role.USER,
        )
        self.admin_user = User.objects.create_user(
            email="admin@example.com",
            password="AdminPassword123!",
            first_name="Admin",
            last_name="Boss",
            role=User.Role.ADMIN,
        )

    def test_normal_user_registration(self):
        url = reverse("auth-register")
        data = {
            "email": "newuser@example.com",
            "password": "Password1234!",
            "password_confirm": "Password1234!",
            "first_name": "New",
            "last_name": "Guy",
            "role": "USER",
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("tokens", response.data)
        self.assertIn("access", response.data["tokens"])
        self.assertEqual(response.data["user"]["role"], "USER")

    def test_admin_user_registration(self):
        url = reverse("auth-register")
        data = {
            "email": "newadmin@example.com",
            "password": "Password1234!",
            "password_confirm": "Password1234!",
            "first_name": "Super",
            "last_name": "Admin",
            "role": "ADMIN",
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["user"]["role"], "ADMIN")
        user = User.objects.get(email="newadmin@example.com")
        self.assertTrue(user.is_staff)

    def test_login_success(self):
        url = reverse("auth-login")
        response = self.client.post(url, {"email": "user@example.com", "password": "StrongPassword123!"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("tokens", response.data)
        self.assertIn("access", response.data["tokens"])
        self.assertIn("refresh", response.data["tokens"])

    def test_login_invalid_credentials(self):
        url = reverse("auth-login")
        response = self.client.post(url, {"email": "user@example.com", "password": "WrongPassword"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_me_endpoint_authenticated(self):
        self.client.force_authenticate(user=self.normal_user)
        url = reverse("auth-me")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "user@example.com")
        self.assertEqual(response.data["role"], "USER")

    def test_admin_user_list_forbidden_for_normal_user(self):
        self.client.force_authenticate(user=self.normal_user)
        url = reverse("admin-user-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_user_list_allowed_for_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse("admin-user-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data["results"] if "results" in response.data else response.data), 2)
