# Truncate IDE API Documentation

## Overview

This documentation specifies the API endpoints required for the **Truncate IDE** desktop application to authenticate and validate user licenses.

**Base URL**: `https://truncate-demo-portal.onrender.com`  
**Authentication**: Bearer Token (JWT) required for protected endpoints. Obtain this via the `/auth/ide/login` handshake.

---

## Authentication Endpoints

### POST `/auth/ide/login`
The primary entry point for the IDE. Authenticates a user using their Portal Username and Secret Key (Passkey).

**Request Body:**
```json
{
  "username": "ceo_truncate",
  "secret_key": "my_secure_passkey"
}
```

**Response:**
```json
{
  "success": true,
  "message": "IDE Login successful",
  "data": {
    "token": "ide_jwt_token_here",
    "username": "ceo_truncate",
    "email": "ceo@truncateide.app",
    "expires_at": "2024-03-01T00:00:00Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid username or passkey, or subscription inactive/expired.

---

## License & Access Endpoints

*Endpoints in this section require authentication via the IDE JWT token in the Authorization header.*

### GET `/api/license/validate`
Check the current state of the user's subscription and license validity. Use this to determine if the IDE should remain in "Authorized" mode.

**Headers:**
- `Authorization: Bearer <IDE_TOKEN>`

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "expires_at": "2024-03-01T00:00:00Z"
  }
}
```

### GET `/api/ide/access`
Refresh the IDE access token using a valid session.

**Headers:**
- `Authorization: Bearer <IDE_TOKEN>`

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "new_ide_access_token_here"
  }
}
```

---

## Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "message": "Error description"
}
```

### Common HTTP Status Codes
- `200 OK`: Request successful.
- `401 Unauthorized`: Handshake failed or token expired.
- `403 Forbidden`: Access denied (e.g., subscription expired).
- `500 Internal Server Error`: Infrastructure failure.

---

## Rate Limiting

To maintain system integrity, the following limits are enforced:
- **IDE Login**: 5 handshake requests per minute per IP.
- **License Validation**: 30 requests per minute.

---

## IDE Integration Tips

For native IDE authentication and licensing:

1. **Direct IDE Login**: Use the `/auth/ide/login` endpoint for the initial handshake. This returns a dedicated IDE JWT.
2. **License Validation**: Call `/api/license/validate` on startup and every 4 hours to verify the active subscription.
3. **Session Management**: IDE tokens have a 24-hour expiration. Securely persist the token and handle `401` errors by prompting the user for their passkey again.
4. **Offline Mode**: If the server is unreachable, the IDE should allow grace period access based on the last successful `expires_at` timestamp.

---

## Notes

- All timestamps are in UTC format.
- Always handle network timeouts gracefully.
- Send `Content-Type: application/json` for all POST requests.
