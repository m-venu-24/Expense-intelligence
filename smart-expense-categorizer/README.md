# Smart Expense Categorizer

Smart Expense Categorizer is a full-stack web app that reads a bank statement CSV, assigns each transaction to a spending category using keyword matching, and visualizes the results in a clean dashboard.

## Features

- Upload a CSV file with `Date`, `Merchant`, and `Amount` columns
- Automatically categorize merchants into Food, Transport, Shopping, Groceries, Entertainment, Utilities, or Others
- View category-wise spending summary cards in Indian Rupees
- See a pie chart breakdown with consistent category colors
- Browse every processed transaction in a responsive table
- Get clear error messages for invalid file types, empty files, and malformed CSVs
- Download a sample CSV and reset the dashboard from the UI

## Project Structure

```text
smart-expense-categorizer/
├── backend/
│   ├── app.py
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.css
│       ├── App.jsx
│       └── main.jsx
└── README.md
```

## Backend Setup

1. Open a terminal in `smart-expense-categorizer/backend`.
2. Create and activate a virtual environment.

```bash
python -m venv venv
venv\Scripts\activate
```

3. Install dependencies.

```bash
pip install -r requirements.txt
```

4. Start the Flask server.

```bash
python app.py
```

The API will run on `http://127.0.0.1:5000`.

Optional quick API check:

```bash
curl http://127.0.0.1:5000/health
```

## Frontend Setup

1. Open a second terminal in `smart-expense-categorizer/frontend`.
2. Install dependencies.

```bash
npm install
```

3. Start the React development server.

```bash
npm run dev
```

The frontend will run on `http://127.0.0.1:5173`.

## Using the App

1. Open the frontend in your browser.
2. Click `Download Sample` if you want a ready-made CSV to test with.
3. Choose a `.csv` file and click `Upload & Analyze`.
4. Review the summary cards, pie chart, and transaction table.
5. Click `Reset` to clear the dashboard and upload another file.

## API

### `POST /upload`

Accepts a multipart form upload with a `file` field containing a CSV.

Successful response shape:

```json
{
  "transactions": [
    {
      "date": "01-03-2026",
      "merchant": "Swiggy",
      "amount": 450,
      "category": "Food"
    }
  ],
  "summary": {
    "Food": 450
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

## Notes

- Categorization uses case-insensitive partial keyword matching.
- The app processes data in memory for each session and does not require a database.
- CORS is enabled in the Flask app for local frontend development.
