# Truncate Portal API Documentation

This documentation provides a comprehensive overview of the Truncate Portal backend API, its architecture, authentication flows, and detailed endpoint references.

## Architecture Overview

The Truncate Portal backend is built using the **Go** programming language and the **Gin** web framework. It follows a clean architecture pattern with separate layers for handlers, services, models, and repositories.

- **Framework**: [Gin Gonic](https://github.com/gin-gonic/gin)
- **Database**: PostgreSQL (managed via GORM)
- **Cache**: Redis
- **Auth**: JWT (JSON Web Tokens) & Google OAuth 2.0
- **Communications**: Email Service for OTPs

---

## Authentication & Security

### 1. User Authentication
Most API endpoints under `/api` require a valid JWT session token.
- **Header**: `Authorization: Bearer <token>`
- **Logic**: Tokens are issued upon successful login (email/password, OTP, or Google).
- **Middleware**: `AuthMiddleware` verifies the token and injects the `userID` into the request context.

### 2. Admin Authentication
Admin-related endpoints under `/api/admin` require an admin-specific JWT.
- **Header**: `Authorization: Bearer <token>`
- **Logic**: Tokens are issued via the admin login endpoint.
- **Middleware**: `AdminAuthMiddleware` ensures the user has the `admin` role.

### 3. Security Headers (CORS/COOP)
- **CORS**: Dynamically allows origins, fallback to `https://account.truncateide.app`.
- **COOP**: `same-origin-allow-popups` (required for Google Auth popups).
- **COEP**: `unsafe-none`.

---

## Endpoint Reference

### Public Routes (`/auth`)

#### `POST /auth/register`
Registers a new user.
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "provider": "email"
  }
  ```
- **Responses**: `201 Created`

#### `POST /auth/login`
Authenticates a user with email and password.
- **Body**: Same as register (minus provider).
- **Data Returned**: Token, User info, `needs_onboarding` flag.

#### `POST /auth/request-otp`
Requests an OTP for login/verification.
- **Body**: `{ "email": "...", "password": "..." }`

#### `POST /auth/verify-otp`
Verifies an OTP and returns a session token.
- **Body**: `{ "email": "...", "code": "123456" }`

#### `POST /auth/google`
Authenticates via Google ID Token.
- **Body**: `{ "id_token": "..." }`

---

### Protected Routes (`/api`)
*Requires Authorization header.*

#### `POST /api/profile/setup`
Sets up user identity (username and secret key).
- **Body**: `{ "username": "...", "secret_key": "..." }`

#### `POST /api/onboarding/questions`
Submits onboarding survey answers.
- **Body**: `[{ "question": "...", "answer": "..." }]`

#### `GET /api/dashboard`
Fetches user profile and subscription status.
- **Logic**: Automatically creates a 2-month free subscription if the user doesn't have one.

#### `GET /api/ide/access`
Generates a temporary access token for the Truncate IDE.
- **Logic**: Checks for an active subscription before issuing the token.

---

### Admin Routes (`/api/admin`)

#### `POST /api/admin/login` (Public)
Admin authentication. Returns an admin JWT.
- **Body**: `{ "username": "...", "secretPin": "..." }`

#### `GET /api/admin/metrics` (Protected)
Fetches high-level usage metrics (total users, active subs, registration trends).

#### `GET /api/admin/users` (Protected)
Lists all registered users.

#### `PUT /api/admin/users/:id` (Protected)
Updates a user's details (e.g., username).

#### `DELETE /api/admin/users/:id` (Protected)
Deletes a user and all associated records (onboarding, subscriptions).

#### `GET /api/admin/subscriptions` (Protected)
Lists all subscriptions with associated user info.

#### `POST /api/admin/subscriptions/toggle` (Protected)
Starts or stops a user's subscription.
- **Body**: `{ "sub_id": 1, "is_active": true/false }`

---

## Data Models

### User
```go
type User struct {
    ID        uint      `json:"id"`
    Email     string    `json:"email"`
    Username  string    `json:"username"`
    Provider  string    `json:"provider"` // google or email
    CreatedAt time.Time `json:"created_at"`
}
```

### Subscription
```go
type Subscription struct {
    ID        uint      `json:"id"`
    UserID    uint      `json:"user_id"`
    StartDate time.Time `json:"start_date"`
    EndDate   time.Time `json:"end_date"`
    IsActive  bool      `json:"is_active"`
}
```

### OnboardingData
```go
type OnboardingData struct {
    UserID   uint   `json:"user_id"`
    Question string `json:"question"`
    Answer   string `json:"answer"`
}
```

---

## Features & Implementation Details

- **Automatic Subscriptions**: Upon first visit to the dashboard, users are granted a 2-month trial period.
- **IDE Access Control**: Access to the IDE is strictly gated by host-side validation of subscription active status and expiration date.
- **Admin Audit**: Deleting a user performs a transactionally safe cleanup of all related data.
- **Dynamic Onboarding**: Handles both identity setup and configurable onboarding surveys.
