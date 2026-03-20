from io import StringIO

import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS


app = Flask(__name__)
CORS(app)


CATEGORY_KEYWORDS = {
    "Food": ["Swiggy", "Zomato", "McDonald's", "KFC", "Dominos"],
    "Transport": ["Uber", "Ola", "Rapido", "IRCTC", "MakeMyTrip"],
    "Shopping": ["Amazon", "Flipkart", "Myntra", "Ajio", "Nykaa"],
    "Groceries": ["Big Bazaar", "DMart", "Blinkit", "Zepto", "Reliance Fresh"],
    "Entertainment": ["Netflix", "Spotify", "BookMyShow", "Hotstar"],
    "Utilities": ["Airtel", "Jio", "BSNL", "BESCOM", "TATA Power"],
}

REQUIRED_COLUMNS = ["Date", "Merchant", "Amount"]
ALL_CATEGORIES = [
    "Food",
    "Transport",
    "Shopping",
    "Groceries",
    "Entertainment",
    "Utilities",
    "Others",
]


def categorize_merchant(merchant_name: str) -> str:
    merchant_name = str(merchant_name).strip().lower()

    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword.lower() in merchant_name:
                return category

    return "Others"


def normalize_amount(value):
    cleaned = str(value).replace("₹", "").replace(",", "").strip()
    return pd.to_numeric(cleaned, errors="coerce")


@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok"})


@app.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded. Please choose a CSV file."}), 400

    uploaded_file = request.files["file"]

    if uploaded_file.filename == "":
        return jsonify({"error": "No file selected. Please choose a CSV file."}), 400

    if not uploaded_file.filename.lower().endswith(".csv"):
        return jsonify({"error": "Invalid file type. Only CSV files are supported."}), 400

    try:
        content = uploaded_file.read().decode("utf-8").strip()
    except UnicodeDecodeError:
        return jsonify({"error": "Could not read the file. Please upload a UTF-8 CSV."}), 400

    if not content:
        return jsonify({"error": "The uploaded file is empty."}), 400

    try:
        dataframe = pd.read_csv(StringIO(content))
    except Exception:
        return jsonify({"error": "Unable to parse CSV. Please check the file format."}), 400

    missing_columns = [column for column in REQUIRED_COLUMNS if column not in dataframe.columns]
    if missing_columns:
        return jsonify(
            {
                "error": (
                    "Missing required column(s): "
                    + ", ".join(missing_columns)
                    + ". Expected columns: Date, Merchant, Amount."
                )
            }
        ), 400

    if dataframe.empty:
        return jsonify({"error": "The uploaded CSV has no transaction rows."}), 400

    dataframe = dataframe[REQUIRED_COLUMNS].copy()
    dataframe["Merchant"] = dataframe["Merchant"].fillna("").astype(str).str.strip()
    dataframe["Date"] = dataframe["Date"].fillna("").astype(str).str.strip()
    dataframe["Amount"] = dataframe["Amount"].apply(normalize_amount)
    dataframe = dataframe.dropna(subset=["Amount"])

    if dataframe.empty:
        return jsonify({"error": "No valid transaction amounts found in the CSV."}), 400

    dataframe["category"] = dataframe["Merchant"].apply(categorize_merchant)

    transactions = [
        {
            "date": row["Date"],
            "merchant": row["Merchant"],
            "amount": round(float(row["Amount"]), 2),
            "category": row["category"],
        }
        for _, row in dataframe.iterrows()
    ]

    summary_series = dataframe.groupby("category")["Amount"].sum()
    summary = {
        category: round(float(summary_series.get(category, 0.0)), 2)
        for category in ALL_CATEGORIES
    }

    return jsonify({"transactions": transactions, "summary": summary})


if __name__ == "__main__":
    app.run(debug=True)
