# 🔗 Bitespeed Backend Task: Identity Reconciliation

> A production-ready web service that links customer identities across multiple purchases — even when different emails or phone numbers are used.

---

## 🚀 Live Endpoint

| Environment | URL |
|-------------|------|
| **Production** | `https://bitespeed-identity-reconciliation-g4sb.onrender.com` |
| **Local** | `http://localhost:3000/identify` |

---

## 📖 Problem Statement

FluxKart.com uses Bitespeed to collect customer contact details for a personalized shopping experience.

However, customers may use:
- Different email addresses
- Different phone numbers
- Partial information per purchase

### 🎯 Objective

Design a backend service that:

- Links contacts if they share **email OR phone number**
- Maintains a **primary–secondary** relationship
- Merges identities when separate contact groups are discovered to belong to the same person
- Always keeps the **oldest contact as primary**

---

## 🧠 Identity Rules

- First contact → marked as `"primary"`
- Matching contact → created as `"secondary"`
- If two primary contacts must be merged:
  - The **older** remains primary
  - The newer becomes secondary
- All secondary contacts store `linkedId` referencing the primary

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|----------|
| **Node.js** | Runtime |
| **TypeScript** | Type safety |
| **Express.js** | REST API framework |
| **SQLite (better-sqlite3)** | Lightweight relational DB |
| **CORS** | Cross-origin support |
| **Nodemon** | Development hot reload |

---

## 📁 Project Structure

```
bitespeed-identity-reconciliation/
│
├── src/
│   ├── index.ts          # Express server & routes
│   ├── database.ts       # SQLite initialization & schema
│   ├── service.ts        # Core reconciliation logic
│   └── types.ts          # Type definitions
│
├── dist/                 # Compiled JS (generated)
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone Repository

```bash
git clone https://github.com/<your-username>/bitespeed-identity-reconciliation.git
cd bitespeed-identity-reconciliation
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Run in Development

```bash
npm run dev
```

Server runs at:

```
http://localhost:3000
```

### 4️⃣ Build for Production

```bash
npm run build
npm start
```

---

## 🗄️ Database Schema

```sql
CREATE TABLE Contact (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    phoneNumber     TEXT,
    email           TEXT,
    linkedId        INTEGER,
    linkPrecedence  TEXT NOT NULL,
    createdAt       DATETIME NOT NULL,
    updatedAt       DATETIME NOT NULL,
    deletedAt       DATETIME,
    FOREIGN KEY (linkedId) REFERENCES Contact(id)
);
```

### Optimizations

- Indexed `email`, `phoneNumber`, and `linkedId`
- WAL mode enabled
- Soft delete support via `deletedAt`

---

## 🔌 API Reference

### POST `/identify`

#### Request Body

```json
{
  "email": "string (optional)",
  "phoneNumber": "string or number (optional)"
}
```

At least one field is required.

---

### Success Response (200)

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["example@email.com"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```

> Note: `primaryContatctId` spelling matches Bitespeed specification intentionally.

---

### Error Response (400)

```json
{
  "error": "At least one of email or phoneNumber must be provided"
}
```

---

## 🧪 Example Flow

### Scenario: New Contact

```json
{
  "email": "lorraine@hillvalley.edu",
  "phoneNumber": "123456"
}
```

Creates new **primary contact**.

---

### Scenario: Same User, New Email

```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

Creates **secondary contact** linked to primary.

---

### Scenario: Merging Two Primaries

If:

- Email matches Contact A
- Phone matches Contact B
- Both are primary

Then:

- Older stays primary
- Newer becomes secondary

---

## 🚀 Deployment (Render)

### Build Command

```
npm install && npm run build
```

### Start Command

```
npm start
```

Plan: Free  
Runtime: Node  

---

## 🧪 Testing

### cURL

```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"test@mail.com","phoneNumber":"123456"}'
```

---

## 📜 Available Scripts

| Command | Description |
|----------|-------------|
| `npm run dev` | Development mode |
| `npm run build` | Compile TypeScript |
| `npm start` | Run production server |

---

## 🏗️ Architecture Highlights

- Deterministic primary resolution
- Idempotent identity reconciliation
- Transaction-safe merge logic
- Clean separation (Controller → Service → DB)
- Deployable on Render / Railway / Fly.io

---

## 👩‍💻 Author

Gurrampati Lavanya 
Backend Developer | TypeScript | Systems Design Enthusiast
