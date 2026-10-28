# MailHub - Multi-Account Gmail Management System (Django Backend)

MailHub is a multi-account Gmail management system built with **Django** and **Django REST Framework**. It features its own application user authentication system with Role-Based Access Control (RBAC), and integrates with Google's official Gmail API using OAuth 2.0 to securely connect, manage, send, and delete emails across multiple Gmail accounts without storing Gmail passwords.

---

## Key Features

### 1. Dual User Roles
- **Normal User (`role: USER`)**:
  - Registers and authenticates into the MailHub platform.
  - Connects multiple Gmail accounts under their own profile.
  - Reads, searches, composes, replies, forwards, trashes, restores, and permanently deletes emails from their own connected Gmail accounts.
  - Isolated from other users' accounts.
- **Admin User (`role: ADMIN` or staff/superuser)**:
  - Can view all registered users and all connected Gmail accounts across the entire platform.
  - Full oversight: Can read, search, send, edit labels, move to trash, restore, and permanently delete emails for **any** connected account.
  - Access to administrative overview and user management APIs.

### 2. Multi-Account Gmail Management
- Connect multiple Gmail accounts per application user.
- Disconnect any connected account at any time.
- Display connection status, token validity, and Google account details.
- **Automatic Token Refresh**: Automatically refreshes expired Google OAuth access tokens using refresh tokens with offline access.
- **Encrypted Credentials**: Stored access tokens and refresh tokens are encrypted at rest using AES-CBC (Fernet symmetric encryption).

### 3. Email Operations
- **Inbox & Folders**: View emails from Inbox, Sent, Drafts, Trash, Spam, Starred, and Important.
- **Email Detail**: Read complete messages, decoded HTML, plain text, and download attachments.
- **Search**: Full search capability using Gmail query syntax (`q`).
- **Send & Threaded Reply**: Compose new HTML/text emails with attachments, reply with thread tracking (`In-Reply-To`, `References`, `threadId`), and forward emails.
- **Two-Step Deletion**:
  - **Action 1 - Move to Trash**: `users.messages.trash` moves the message to Trash.
  - **Action 2 - Permanent Delete**: `users.messages.delete` permanently deletes the message.
  - **Empty Trash**: Permanently deletes all messages in the Trash folder.
- **Labels & Organization**: Mark read/unread, star/unstar, and archive.

---

## Technology Stack

- **Framework**: Django 5.2 + Django REST Framework 3.18
- **Authentication**: SimpleJWT (JSON Web Tokens)
- **Security & Encryption**: Cryptography (Fernet symmetric encryption)
- **Google Integration**: Google API Python Client + Google Auth OAuthlib
- **Database**: PostgreSQL support with SQLite fallback for seamless development
- **CORS**: `django-cors-headers` enabled for frontend development (e.g. Vite + React)

---

## Directory Structure

```text
d:\MultiGmail\
├── manage.py
├── requirements.txt
├── .env.example
├── .env
├── config/
│   ├── settings.py
│   ├── urls.py
│   ├── asgi.py
│   └── wsgi.py
├── accounts/
│   ├── models.py            # Custom User model (role: USER, ADMIN)
│   ├── permissions.py       # IsAdminUserRole, IsOwnerOrAdmin
│   ├── serializers.py       # Auth & User serializers
│   ├── views.py             # Register, Login, Logout, Me, Password Reset, Admin Users
│   ├── urls.py
│   └── tests.py
└── gmail_accounts/
    ├── models.py            # GmailAccount (encrypted tokens), EmailCache
    ├── serializers.py       # Gmail account and email payloads
    ├── views.py             # Connect, Callback, Folders, Email actions
    ├── urls.py
    ├── tests.py
    └── services/
        ├── crypto_service.py   # Fernet token encryption/decryption
        ├── oauth_service.py    # Google OAuth flow & signed state handling
        ├── gmail_service.py    # Gmail API client & message actions
        └── message_parser.py   # MIME decoding & attachment parsing
```

---

## Getting Started

### 1. Activate Virtual Environment
```powershell
.\venv\Scripts\activate
```

### 2. Configure Environment (`.env`)
Copy `.env.example` to `.env` (already created with generated encryption key):
```ini
SECRET_KEY=django-insecure-multi-gmail-hub-super-secret-key-change-in-production-2026
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Token Encryption Key (Fernet 32-url-safe-base64-encoded bytes)
ENCRYPTION_KEY=plDA8-bH55c8-oOvsmym-tGjoJ97kFYylbLi2OIkmcc=

# Google Cloud OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/gmail/oauth/callback/

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

### 3. Run Migrations
```powershell
.\venv\Scripts\python.exe manage.py migrate
```

### 4. Create an Initial Superuser / Admin
```powershell
.\venv\Scripts\python.exe manage.py createsuperuser
```

### 5. Start the Server
```powershell
.\venv\Scripts\python.exe manage.py runserver
```

---

## API Endpoints Reference

### Authentication (`/api/v1/auth/`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register/` | Register user (`role`: `"USER"` or `"ADMIN"`) |
| `POST` | `/api/v1/auth/login/` | Log in and receive JWT `access` & `refresh` |
| `POST` | `/api/v1/auth/token/refresh/` | Refresh JWT access token |
| `POST` | `/api/v1/auth/logout/` | Blacklist refresh token |
| `GET` | `/api/v1/auth/me/` | Current user profile |
| `POST` | `/api/v1/auth/change-password/` | Change password for logged in user |
| `POST` | `/api/v1/auth/password-reset/` | Request password reset token |
| `POST` | `/api/v1/auth/password-reset-confirm/` | Confirm password reset |

### Admin Management (`/api/v1/auth/admin/` & `/api/v1/gmail/admin/`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/gmail/admin/overview/` | Platform stats: user counts, connected accounts |
| `GET` | `/api/v1/auth/admin/users/` | List all registered users (Admin only) |
| `GET/PATCH/DELETE` | `/api/v1/auth/admin/users/<id>/` | View, update role, or delete user |

### Gmail Account Connection (`/api/v1/gmail/`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/gmail/accounts/` | List accounts (User sees own; Admin sees all) |
| `POST` | `/api/v1/gmail/accounts/connect/` | Get Google OAuth authorization URL |
| `GET` | `/api/v1/gmail/oauth/callback/` | Google OAuth callback handler |
| `GET` | `/api/v1/gmail/accounts/<id>/` | View account details |
| `DELETE` | `/api/v1/gmail/accounts/<id>/` | Disconnect Gmail account |
| `GET` | `/api/v1/gmail/accounts/<id>/profile/` | Account mailbox statistics |

### Email Operations (`/api/v1/gmail/accounts/<id>/`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `.../emails/` | List inbox emails (`q`, `page_token`, `max_results`) |
| `GET` | `.../folders/<folder>/` | List folder emails (`inbox`, `sent`, `drafts`, `trash`, `spam`, `starred`, `important`) |
| `GET` | `.../search/?q=<query>` | Search emails using Gmail search syntax |
| `GET` | `.../emails/<msg_id>/` | View complete email details, body, attachments |
| `GET` | `.../emails/<msg_id>/attachments/<att_id>/` | Download email attachment |
| `POST` | `.../send/` | Send email (`to`, `subject`, `body_text`/`html`, attachments) |
| `POST` | `.../emails/<msg_id>/reply/` | Reply to email |
| `POST` | `.../emails/<msg_id>/forward/` | Forward email |
| `POST` | `.../emails/<msg_id>/trash/` | **Move to Trash** |
| `POST` | `.../emails/<msg_id>/restore/` | **Restore from Trash** |
| `DELETE`| `.../emails/<msg_id>/` | **Permanently delete email** |
| `POST` | `.../trash/empty/` | **Empty entire Trash folder** |
| `POST` | `.../emails/<msg_id>/read/` | Mark as read |
| `POST` | `.../emails/<msg_id>/unread/` | Mark as unread |
| `POST` | `.../emails/<msg_id>/star/` | Star email |
| `POST` | `.../emails/<msg_id>/unstar/` | Unstar email |
| `POST` | `.../emails/<msg_id>/archive/` | Archive email |
| `PATCH`| `.../emails/<msg_id>/labels/` | Add/remove custom labels |
