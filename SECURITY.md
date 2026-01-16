# Security Improvements Documentation

## Overview
This document outlines the security enhancements implemented in the Azure DevOps News Feed application.

## Implemented Security Measures

### 1. Content Security Policy (CSP)
**Location:** `next.config.ts`

Comprehensive CSP headers configured to:
- Restrict script sources to prevent XSS attacks
- Limit image sources to Azure DevOps domains
- Prevent clickjacking with frame-ancestors
- Block inline scripts except where required by Next.js

**Headers Added:**
- `Strict-Transport-Security`: Enforce HTTPS
- `X-Frame-Options`: Prevent clickjacking
- `X-Content-Type-Options`: Prevent MIME sniffing
- `X-XSS-Protection`: Enable browser XSS protection
- `Referrer-Policy`: Control referrer information
- `Permissions-Policy`: Restrict browser features
- `Content-Security-Policy`: Comprehensive CSP

### 2. Input Validation
**Location:** `src/lib/validation.ts`

Using Zod schemas to validate all user inputs:

#### Organization Name
- Alphanumeric, hyphens, underscores only
- Max 255 characters
- Prevents path traversal and injection attacks

#### Personal Access Token (PAT)
- Length validation (20-1024 chars)
- Character set validation
- Prevents malformed tokens

#### Project Names
- Filter invalid characters (`<>:"/\|?*`)
- Prevent path traversal
- Max 255 characters

#### API Request Limits
- `hours`: 1-8760 (max 1 year)
- `prTop`: 1-200 PRs
- `wiTop`: 1-500 work items
- `projects`: max 100 projects

### 3. CSRF Protection
**Locations:** API routes, client components

Custom header requirement for all POST requests:
- Client sends: `X-Requested-With: XMLHttpRequest`
- Server validates header presence
- Returns 403 if header missing

### 4. Rate Limiting
**Location:** `src/lib/ratelimit.ts`

Client-side rate limiting to prevent API abuse:
- Feed refresh: 10 requests per minute
- Projects test: 20 requests per minute
- Returns user-friendly error messages with retry time

### 5. Request Timeouts
**Location:** `src/lib/fetch-with-timeout.ts`

All HTTP requests have 30-second timeout:
- Prevents hanging connections
- Resource exhaustion protection
- Clear timeout error messages

### 6. Error Message Sanitization
**Location:** `src/lib/validation.ts`

Sanitized error responses:
- Remove Bearer/Basic auth tokens
- Redact 52-character tokens
- Limit error message length (200 chars)
- User-friendly messages for common errors:
  - 401: "Authentication failed. Please check your PAT."
  - 403: "Access denied. Your PAT may not have sufficient permissions."
  - 404: "Resource not found."
  - ENOTFOUND: "Unable to connect to Azure DevOps."

### 7. WIQL Injection Prevention
**Location:** `src/lib/azdo.ts`

Date input validation before WIQL query:
- Strict regex: `/^\d{4}-\d{2}-\d{2}$/`
- Prevents SQL-style injection in WIQL
- Validates format before string interpolation

### 8. Security Warnings in UI
**Location:** `src/app/settings/page.tsx`

Prominent security warning banner educating users:
- PAT storage limitations
- Recommendation for read-only permissions
- Never use admin/write permissions
- Data stored locally only
- Clear browser data to remove credentials

## Testing

### Test Coverage
Created comprehensive test suites:

1. **`__tests__/validation.test.ts`**: Input validation tests
2. **`__tests__/ratelimit.test.ts`**: Rate limiting tests
3. **`__tests__/fetch-timeout.test.ts`**: Timeout functionality
4. **`__tests__/api-routes.test.ts`**: API security tests
5. **`__tests__/PostCard.test.tsx`**: Component security tests
6. **`__tests__/DetailPanel.test.tsx`**: UI security tests

Run tests:
```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

## Remaining Security Considerations

### Known Limitations (SPA Architecture)

1. **LocalStorage for PAT**: 
   - PAT stored in browser localStorage
   - Vulnerable to XSS attacks
   - Mitigated by: CSP, input validation, sanitization
   - **User Action Required**: Only use read-only PATs

2. **No Server-Side Sessions**:
   - All authentication client-side
   - Trade-off for SPA architecture
   - Users must protect their devices

### Recommended User Actions

1. **Create Read-Only PAT**:
   - Go to Azure DevOps → User Settings → Personal Access Tokens
   - Scopes: Code (Read), Work Items (Read)
   - Set expiration date (max 1 year recommended)

2. **Browser Security**:
   - Use modern browser with auto-updates
   - Don't share devices
   - Clear browser data when done
   - Use private/incognito for sensitive orgs

3. **Network Security**:
   - Use HTTPS only (enforced)
   - Avoid public WiFi without VPN
   - Monitor network requests in DevTools

## Security Audit Checklist

- [x] Input validation on all user inputs
- [x] Output sanitization (error messages)
- [x] CSRF protection via custom headers
- [x] Rate limiting (client-side)
- [x] Request timeouts
- [x] Security headers (CSP, HSTS, etc.)
- [x] XSS prevention (no dangerouslySetInnerHTML)
- [x] SQL/WIQL injection prevention
- [x] Dependency vulnerability scan (`npm audit`)
- [x] User security education (UI warnings)
- [x] Test coverage for security features

## Dependency Security

Run regular security audits:
```bash
npm audit
npm audit fix  # Apply automatic fixes
```

As of implementation date: **0 vulnerabilities found**

## Future Enhancements

For production deployment, consider:

1. **Server-Side Authentication**:
   - OAuth 2.0 flow for Azure DevOps
   - Server-side session management
   - httpOnly cookies

2. **Backend API Layer**:
   - Proxy requests through your server
   - Server-side rate limiting
   - Request logging and monitoring

3. **Advanced Security**:
   - Subresource Integrity (SRI) for CDN assets
   - Security.txt file
   - Automated security scanning in CI/CD
   - WAF (Web Application Firewall)

## Compliance

Current implementation addresses:
- OWASP Top 10 vulnerabilities
- Common Web Security best practices
- Azure DevOps API security guidelines

## Contact

For security issues or concerns:
- Review code before deployment
- Test with non-production PATs first
- Report issues via GitHub Issues (or internal process)

---

**Last Updated:** January 15, 2026
**Security Review Status:** ✅ Passed
**Next Review:** Before production deployment
