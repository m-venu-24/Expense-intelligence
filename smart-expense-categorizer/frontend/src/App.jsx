import { useEffect, useMemo, useRef, useState } from "react";
import { Pie } from "react-chartjs-2";
import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
} from "chart.js";
import Papa from "papaparse";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase";

ChartJS.register(ArcElement, Tooltip, Legend);

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
const REQUIRED_COLUMNS = ["Date", "Merchant", "Amount"];

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);

const emptySummary = () =>
  CATEGORY_ORDER.reduce((accumulator, category) => {
    accumulator[category] = 0;
    return accumulator;
  }, {});

const normalizeAmount = (amount) => {
  const normalized = String(amount ?? "")
    .replaceAll(",", "")
    .replace(/[^\d.-]/g, "")
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const categorizeMerchant = (merchant) => {
  const merchantName = String(merchant || "").toLowerCase().trim();

  const categories = {
    Food: ["swiggy", "zomato", "mcdonald", "kfc", "dominos"],
    Transport: ["uber", "ola", "rapido", "irctc", "makemytrip"],
    Shopping: ["amazon", "flipkart", "myntra", "ajio", "nykaa"],
    Groceries: ["big bazaar", "dmart", "blinkit", "zepto", "reliance fresh"],
    Entertainment: ["netflix", "spotify", "bookmyshow", "hotstar"],
    Utilities: ["airtel", "jio", "bsnl", "bescom", "tata power"],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    const hasMatch = keywords.some((keyword) => merchantName.includes(keyword));
    if (hasMatch) return category;
  }

  return "Others";
};

function App() {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [authError, setAuthError] = useState("");

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

  const loadLatestUpload = async (uid) => {
    const uploadsRef = collection(db, "expenseUploads");
    const latestUploadQuery = query(uploadsRef, where("uid", "==", uid), limit(20));

    const snapshot = await getDocs(latestUploadQuery);
    if (snapshot.empty) {
      setTransactions([]);
      setSummary(emptySummary());
      return;
    }

    const latestUpload = snapshot.docs
      .map((doc) => doc.data())
      .sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      })[0];
    setTransactions(latestUpload.transactions || []);
    setSummary({
      ...emptySummary(),
      ...(latestUpload.summary || {}),
    });
    setStatusMessage("Loaded your most recent uploaded report.");
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setAuthLoading(false);
      setAuthError("");
      setError("");
      setStatusMessage("");

      if (user) {
        try {
          await loadLatestUpload(user.uid);
        } catch (loadError) {
          setError(loadError.message || "Could not load previous uploads.");
          setTransactions([]);
          setSummary(emptySummary());
        }
      } else {
        setTransactions([]);
        setSummary(emptySummary());
      }
    });

    return () => unsubscribe();
  }, []);

  const resetDashboard = () => {
    setFile(null);
    setTransactions([]);
    setSummary(emptySummary());
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
    setSummary(emptySummary());

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

  const parseTransactions = async (csvFile) => {
    const csvText = await csvFile.text();
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parsed.errors.length > 0) {
      throw new Error("Could not parse CSV. Please check file format.");
    }

    const headers = parsed.meta.fields || [];
    const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
    if (missingColumns.length > 0) {
      throw new Error(
        `Missing required column(s): ${missingColumns.join(", ")}. Expected Date, Merchant, Amount.`
      );
    }

    const rows = parsed.data || [];
    if (rows.length === 0) {
      throw new Error("The uploaded CSV has no transaction rows.");
    }

    const processedTransactions = rows
      .map((row) => {
        const amount = normalizeAmount(row.Amount);
        if (amount === null) return null;

        const merchant = String(row.Merchant || "").trim();
        const date = String(row.Date || "").trim();
        return {
          date,
          merchant,
          amount: Number(amount.toFixed(2)),
          category: categorizeMerchant(merchant),
        };
      })
      .filter(Boolean);

    if (processedTransactions.length === 0) {
      throw new Error("No valid transaction amounts found in the CSV.");
    }

    const computedSummary = emptySummary();
    for (const transaction of processedTransactions) {
      computedSummary[transaction.category] += transaction.amount;
    }

    for (const category of CATEGORY_ORDER) {
      computedSummary[category] = Number(computedSummary[category].toFixed(2));
    }

    return {
      processedTransactions,
      computedSummary,
    };
  };

  const handleAuthSubmit = async () => {
    setAuthError("");
    setStatusMessage("");

    if (!email || !password) {
      setAuthError("Please enter both email and password.");
      return;
    }

    try {
      if (authMode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
        setStatusMessage("Account created and signed in.");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        setStatusMessage("Signed in successfully.");
      }
      setPassword("");
    } catch (firebaseError) {
      setAuthError(firebaseError.message || "Authentication failed.");
    }
  };

  const handleLogout = async () => {
    setAuthError("");
    setStatusMessage("");
    try {
      await signOut(auth);
      resetDashboard();
      setStatusMessage("You have been signed out.");
    } catch (firebaseError) {
      setAuthError(firebaseError.message || "Could not sign out.");
    }
  };

  const handleUpload = async () => {
    if (!authUser) {
      setError("Please sign in to upload and save your expense report.");
      return;
    }

    if (!file) {
      setError("Please select a CSV file before uploading.");
      return;
    }

    setLoading(true);
    setError("");
    setStatusMessage("");

    try {
      const { processedTransactions, computedSummary } = await parseTransactions(file);
      await addDoc(collection(db, "expenseUploads"), {
        uid: authUser.uid,
        email: authUser.email,
        fileName: file.name,
        transactions: processedTransactions,
        summary: computedSummary,
        createdAt: serverTimestamp(),
      });

      setTransactions(processedTransactions);
      setSummary(computedSummary);
      setStatusMessage(`Processed and saved ${processedTransactions.length} transactions.`);
    } catch (uploadError) {
      setTransactions([]);
      setSummary(emptySummary());
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
            Firebase powered, secure, and account based. Upload your bank statement and
            get an instant, color-coded spending breakdown.
          </p>
        </div>
        <div className="upload-panel">
          {authLoading ? (
            <p className="helper-text">Checking session...</p>
          ) : authUser ? (
            <div className="auth-state">
              <p className="helper-text">
                Signed in as <strong>{authUser.email}</strong>
              </p>
              <button type="button" className="secondary-button" onClick={handleLogout}>
                Log Out
              </button>
            </div>
          ) : (
            <div className="auth-box">
              <div className="auth-mode-switch">
                <button
                  type="button"
                  className={authMode === "login" ? "mode-active" : "secondary-button"}
                  onClick={() => setAuthMode("login")}
                >
                  Log In
                </button>
                <button
                  type="button"
                  className={authMode === "signup" ? "mode-active" : "secondary-button"}
                  onClick={() => setAuthMode("signup")}
                >
                  Sign Up
                </button>
              </div>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button type="button" onClick={handleAuthSubmit}>
                {authMode === "signup" ? "Create Account" : "Sign In"}
              </button>
              {authError && <p className="auth-error">{authError}</p>}
            </div>
          )}

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
            <button type="button" onClick={handleUpload} disabled={loading || !file || !authUser}>
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
          {!authUser && !authLoading && (
            <p className="helper-text">Sign in first to upload and persist your reports.</p>
          )}
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

