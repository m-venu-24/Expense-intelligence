import { useMemo, useRef, useState } from "react";
import { Pie } from "react-chartjs-2";
import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const API_URL = "http://127.0.0.1:5000/upload";

const CATEGORY_COLORS = {
  Food: "#ff6b6b",
  Transport: "#4dabf7",
  Shopping: "#845ef7",
  Groceries: "#51cf66",
  Entertainment: "#f59f00",
  Utilities: "#20c997",
  Others: "#868e96",
};

const CATEGORY_ORDER = [
  "Food",
  "Transport",
  "Shopping",
  "Groceries",
  "Entertainment",
  "Utilities",
  "Others",
];

const SAMPLE_CSV = `Date,Merchant,Amount
01-03-2026,Swiggy,450
02-03-2026,Uber,230
03-03-2026,Amazon,1200
04-03-2026,Big Bazaar,980
05-03-2026,Netflix,499`;

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);

function App() {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(
    CATEGORY_ORDER.reduce((accumulator, category) => {
      accumulator[category] = 0;
      return accumulator;
    }, {})
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const orderedSummaryEntries = useMemo(
    () => CATEGORY_ORDER.map((category) => [category, summary[category] || 0]),
    [summary]
  );

  const chartData = useMemo(() => {
    const labels = orderedSummaryEntries
      .filter(([, amount]) => amount > 0)
      .map(([category]) => category);

    return {
      labels,
      datasets: [
        {
          label: "Spending",
          data: labels.map((label) => summary[label]),
          backgroundColor: labels.map((label) => CATEGORY_COLORS[label] || CATEGORY_COLORS.Others),
          borderColor: "#ffffff",
          borderWidth: 2,
        },
      ],
    };
  }, [orderedSummaryEntries, summary]);

  const totalSpent = useMemo(
    () => Object.values(summary).reduce((accumulator, amount) => accumulator + amount, 0),
    [summary]
  );

  const resetDashboard = () => {
    setFile(null);
    setTransactions([]);
    setSummary(
      CATEGORY_ORDER.reduce((accumulator, category) => {
        accumulator[category] = 0;
        return accumulator;
      }, {})
    );
    setError("");
    setStatusMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    setError("");
    setStatusMessage("");
    setTransactions([]);
    setSummary(
      CATEGORY_ORDER.reduce((accumulator, category) => {
        accumulator[category] = 0;
        return accumulator;
      }, {})
    );

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setError("Please upload a valid CSV file.");
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
    setStatusMessage("CSV selected and ready to analyze.");
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a CSV file before uploading.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setError("");
    setStatusMessage("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : { error: "Unexpected server response. Please try again." };

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong while uploading the file.");
      }

      setTransactions(data.transactions || []);
      setSummary(
        CATEGORY_ORDER.reduce((accumulator, category) => {
          accumulator[category] = data.summary?.[category] || 0;
          return accumulator;
        }, {})
      );
      setStatusMessage(`Processed ${data.transactions?.length || 0} transactions successfully.`);
    } catch (uploadError) {
      setTransactions([]);
      setSummary(
        CATEGORY_ORDER.reduce((accumulator, category) => {
          accumulator[category] = 0;
          return accumulator;
        }, {})
      );
      setError(uploadError.message || "Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const downloadSampleCsv = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sample-expenses.csv";
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage("Sample CSV downloaded.");
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Expense Intelligence</p>
          <h1>Smart Expense Categorizer</h1>
          <p className="hero-copy">
            Upload your bank statement and get an instant, color-coded spending
            breakdown across daily life categories.
          </p>
        </div>
        <div className="upload-panel">
          <label className="file-picker" htmlFor="csv-upload">
            <span>{file ? file.name : "Choose statement CSV"}</span>
            <input
              id="csv-upload"
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
            />
          </label>
          <div className="action-row">
            <button type="button" onClick={handleUpload} disabled={loading || !file}>
              {loading ? "Processing..." : "Upload & Analyze"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={downloadSampleCsv}
              disabled={loading}
            >
              Download Sample
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={resetDashboard}
              disabled={loading && !file}
            >
              Reset
            </button>
          </div>
          <p className="helper-text">
            Expected columns: <strong>Date</strong>, <strong>Merchant</strong>,{" "}
            <strong>Amount</strong>
          </p>
        </div>
      </header>

      {error && <div className="message error-message">{error}</div>}
      {statusMessage && !error && <div className="message success-message">{statusMessage}</div>}

      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Reading transactions and classifying merchants...</p>
        </div>
      )}

      {!loading && transactions.length === 0 && !error && (
        <section className="empty-state">
          <h2>Your dashboard will appear here</h2>
          <p>
            Try the sample format from the README to see category totals, a pie
            chart, and a full transaction table.
          </p>
        </section>
      )}

      {!loading && transactions.length > 0 && (
        <>
          <section className="overview-grid">
            <article className="total-card">
              <p>Total Spent</p>
              <h2>{formatCurrency(totalSpent)}</h2>
              <span>{transactions.length} transactions analyzed</span>
            </article>
            {orderedSummaryEntries.map(([category, amount]) => (
              <article
                className="summary-card"
                key={category}
                style={{ "--accent": CATEGORY_COLORS[category] || CATEGORY_COLORS.Others }}
              >
                <p>{category}</p>
                <h3>{formatCurrency(amount)}</h3>
              </article>
            ))}
          </section>

          <section className="content-grid">
            <div className="panel chart-panel">
              <div className="panel-header">
                <h2>Category Split</h2>
                <p>Pie chart of category-wise spending</p>
              </div>
              <div className="chart-wrap">
                {chartData.labels.length > 0 ? (
                  <Pie
                    data={chartData}
                    options={{
                      plugins: {
                        legend: {
                          position: "bottom",
                          labels: {
                            boxWidth: 12,
                            padding: 16,
                          },
                        },
                      },
                      maintainAspectRatio: false,
                    }}
                  />
                ) : (
                  <div className="chart-empty">
                    <p>Upload a CSV to see the spending split chart.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="panel table-panel">
              <div className="panel-header">
                <h2>Transactions</h2>
                <p>Every uploaded transaction with its assigned category</p>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Merchant</th>
                      <th>Amount</th>
                      <th>Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction, index) => (
                      <tr key={`${transaction.date}-${transaction.merchant}-${index}`}>
                        <td>{transaction.date}</td>
                        <td>{transaction.merchant}</td>
                        <td>{formatCurrency(transaction.amount)}</td>
                        <td>
                          <span
                            className="category-pill"
                            style={{
                              "--pill-color":
                                CATEGORY_COLORS[transaction.category] || CATEGORY_COLORS.Others,
                            }}
                          >
                            {transaction.category}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default App;
