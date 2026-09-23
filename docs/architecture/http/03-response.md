# 03 — HTTP Response & Lifecycle

## Overview

The `HttpResponse` class represents an outgoing HTTP response. It enforces a strict lifecycle state machine to eliminate race conditions and response corruption.

---

## Response Lifecycle States

```
created ──▶ configured ──▶ committed ──▶ completed
```

1. **`created`**: The response instance is instantiated via constructor or static factory (`HttpResponse.json()`, `HttpResponse.text()`, etc.).
2. **`configured`**: Headers, status code, and cookies are adjusted by handlers or middleware.
3. **`committed`**: The underlying adapter starts writing HTTP status and headers to the wire. From this point forward, mutating status, headers, cookies, or replacing the body throws `ResponseAlreadyCommittedError`.
4. **`completed`**: The body transmission is completed and the socket is finished.

---

## Static Factories

```typescript
// JSON
HttpResponse.json({ message: 'Success' }, { status: 200 });

// Text
HttpResponse.text('Hello World', { status: 200 });

// HTML
HttpResponse.html('<h1>Welcome</h1>', { status: 200 });

// Redirect
HttpResponse.redirect('/login', HttpStatus.SEE_OTHER);

// Empty / No Content
HttpResponse.empty(HttpStatus.NO_CONTENT);

// Streaming
HttpResponse.stream(readableStream, { status: 200 });
```
