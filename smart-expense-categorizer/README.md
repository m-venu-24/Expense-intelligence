# Smart Expense Categorizer (Firebase Edition)

This version uses Firebase as the backend platform:
- Firebase Authentication for login and signup
- Cloud Firestore for saving processed uploads per user
- Client-side CSV parsing and categorization in React

## Features

- Email/password authentication
- Upload a CSV file with `Date`, `Merchant`, and `Amount`
- Automatic category tagging (Food, Transport, Shopping, Groceries, Entertainment, Utilities, Others)
- Summary cards with INR formatting
- Pie chart and full transaction table
- Saves each analyzed upload in Firestore for the signed-in user
- Automatically loads the latest saved upload on sign-in

## Project Structure

```text
smart-expense-categorizer/
|-- backend/
|   |-- app.py
|   `-- requirements.txt
|-- frontend/
|   |-- .env.example
|   |-- index.html
|   |-- package.json
|   |-- vite.config.js
|   `-- src/
|       |-- App.css
|       |-- App.jsx
|       |-- firebase.js
|       `-- main.jsx
`-- README.md
```

## Firebase Setup

1. In Firebase Console, create or select your project.
2. Enable Authentication:
   - Open `Authentication` -> `Sign-in method`
   - Enable `Email/Password`
3. Create Firestore database.
4. Register a Web App and copy Firebase config values.
5. In `frontend`, create `.env` from `.env.example`.

```powershell
cd frontend
Copy-Item .env.example .env
```

6. Fill `.env`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## Run Locally

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs on `http://127.0.0.1:5173`.

## Deploy on Vercel

1. Import repo in Vercel.
2. Set Root Directory to `frontend`.
3. Add all `VITE_FIREBASE_*` env variables in Vercel Project Settings.
4. Redeploy.

## Firestore Rules (starter)

Use owner-only rules so each user can only access their own uploads:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /expenseUploads/{docId} {
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
      allow read, update, delete: if request.auth != null && request.auth.uid == resource.data.uid;
    }
  }
}
```

## Sample CSV

```csv
Date,Merchant,Amount
01-03-2026,Swiggy,450
02-03-2026,Uber,230
03-03-2026,Amazon,1200
04-03-2026,Big Bazaar,980
05-03-2026,Netflix,499
```
