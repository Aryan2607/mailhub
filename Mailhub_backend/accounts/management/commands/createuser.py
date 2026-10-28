import getpass
import sys
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from accounts.models import User


class Command(BaseCommand):
    help = (
        "Create a new user (Normal User or Superadmin with full admin access).\n"
        "Prompts interactively for email, password, and admin status if not provided."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            type=str,
            dest="email",
            help="Email address for the new user.",
        )
        parser.add_argument(
            "--password",
            type=str,
            dest="password",
            help="Password for the user (non-interactive mode).",
        )
        parser.add_argument(
            "--admin",
            action="store_true",
            dest="is_admin",
            help="Designate user as Superadmin with full admin access.",
        )
        parser.add_argument(
            "--normal",
            action="store_true",
            dest="is_normal",
            help="Create as Normal User (bypasses admin prompt in script/automation).",
        )
        parser.add_argument(
            "--first-name",
            type=str,
            default="",
            dest="first_name",
            help="Optional first name.",
        )
        parser.add_argument(
            "--last-name",
            type=str,
            default="",
            dest="last_name",
            help="Optional last name.",
        )

    def handle(self, *args, **options):
        email = options.get("email")
        password = options.get("password")
        is_admin = options.get("is_admin", False)
        is_normal = options.get("is_normal", False)
        first_name = options.get("first_name", "")
        last_name = options.get("last_name", "")

        is_interactive = sys.stdin.isatty()

        self.stdout.write(self.style.MIGRATE_HEADING("\n=== MailHub User Creation ==="))

        # 1. Prompt for Email if not supplied
        while not email:
            try:
                entered_email = input("Enter email address: ").strip()
                if not entered_email:
                    self.stdout.write(self.style.WARNING("Email cannot be empty."))
                    continue
                validate_email(entered_email)
                if User.objects.filter(email__iexact=entered_email).exists():
                    self.stdout.write(
                        self.style.ERROR(f"A user with email '{entered_email}' already exists.")
                    )
                    continue
                email = entered_email.lower()
            except ValidationError as e:
                self.stdout.write(self.style.ERROR(f"Invalid email: {', '.join(e.messages)}"))
            except (KeyboardInterrupt, EOFError):
                self.stdout.write("\nOperation cancelled.")
                return

        # If email was provided via --email, validate it
        if options.get("email"):
            try:
                validate_email(email)
            except ValidationError as e:
                raise CommandError(f"Invalid email address '{email}': {', '.join(e.messages)}")
            if User.objects.filter(email__iexact=email).exists():
                raise CommandError(f"A user with email '{email}' already exists.")

        # 2. Prompt for Password if not supplied
        while not password:
            try:
                p1 = getpass.getpass("Enter password: ")
                if not p1:
                    self.stdout.write(self.style.WARNING("Password cannot be empty."))
                    continue
                if len(p1) < 8:
                    self.stdout.write(self.style.WARNING("Password should be at least 8 characters."))
                p2 = getpass.getpass("Confirm password: ")
                if p1 != p2:
                    self.stdout.write(self.style.ERROR("Passwords do not match. Please try again."))
                    continue
                password = p1
            except (KeyboardInterrupt, EOFError):
                self.stdout.write("\nOperation cancelled.")
                return

        # 3. Superadmin vs Normal User resolution
        if not is_admin and not is_normal:
            if is_interactive:
                try:
                    role_input = input(
                        "Should this user have Superadmin access? (y/N) [y: Admin with full access across all accounts, n: Normal user]: "
                    ).strip().lower()
                    is_admin = role_input in ("y", "yes", "true", "1")
                except (KeyboardInterrupt, EOFError):
                    self.stdout.write("\nOperation cancelled.")
                    return
            else:
                is_admin = False

        # 4. Create User
        try:
            if is_admin:
                user = User.objects.create_superuser(
                    email=email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                )
                user.role = User.Role.ADMIN
                user.is_staff = True
                user.is_superuser = True
                user.save()
                role_label = "Superadmin (Full Admin Access Across All Accounts)"
            else:
                user = User.objects.create_user(
                    email=email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                    role=User.Role.USER,
                )
                role_label = "Normal User (Isolated Accounts)"

            self.stdout.write(self.style.SUCCESS(f"\n[OK] Successfully created user!"))
            self.stdout.write(f"  • Email:     {user.email}")
            self.stdout.write(f"  • Role:      {role_label}")
            self.stdout.write(f"  • Staff:     {user.is_staff}")
            self.stdout.write(f"  • Superuser: {user.is_superuser}\n")

        except Exception as e:
            raise CommandError(f"Failed to create user: {str(e)}")
