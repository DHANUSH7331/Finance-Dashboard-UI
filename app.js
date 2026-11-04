(async function bootstrapFinanceDashboard() {
const HANDLE_DB = "finance-dashboard-handles";
const HANDLE_STORE = "directories";
let directoryHandle = null;
let financeFileHandle = null;
let fileWriteQueue = Promise.resolve();

function setStorageStatus(message, connected = false) {
    const status = document.getElementById("storageStatus");
    if (status) {
        status.textContent = message;
        status.dataset.connected = connected ? "true" : "false";
    }
}

function openHandleDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(HANDLE_DB, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(HANDLE_STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveDirectoryHandle(handle) {
    const db = await openHandleDatabase();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(HANDLE_STORE, "readwrite");
        tx.objectStore(HANDLE_STORE).put(handle, "finance-folder");
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

async function loadDirectoryHandle() {
    const db = await openHandleDatabase();
    const handle = await new Promise((resolve, reject) => {
        const tx = db.transaction(HANDLE_STORE, "readonly");
        const request = tx.objectStore(HANDLE_STORE).get("finance-folder");
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
    db.close();
    return handle;
}

function applyFileData(data) {
    if (!data || !Array.isArray(data.transactions) ||
        !data.monthlyIncomes || typeof data.monthlyIncomes !== "object") {
        throw new Error("The selected finance-data.json file has an invalid format.");
    }
    localStorage.setItem("transactions", JSON.stringify(data.transactions));
    localStorage.setItem("monthlyIncomes", JSON.stringify(data.monthlyIncomes));
}

function currentFinanceData() {
    return {
        version: 1,
        updatedAt: new Date().toISOString(),
        transactions: state.transactions,
        monthlyIncomes
    };
}

async function readFinanceFile() {
    if (!financeFileHandle) return false;
    const file = await financeFileHandle.getFile();
    if (!file.size) return false;
    const data = JSON.parse(await file.text());
    applyFileData(data);
    return true;
}

async function writeFinanceFile() {
    if (!financeFileHandle) return;
    const writable = await financeFileHandle.createWritable();
    await writable.write(JSON.stringify(currentFinanceData(), null, 2));
    await writable.close();
    setStorageStatus("Connected — saved to Finance/finance-data.json", true);
}

function persistFinanceFile() {
    if (!financeFileHandle) return;
    fileWriteQueue = fileWriteQueue
        .catch(() => {})
        .then(writeFinanceFile)
        .catch(error => {
            console.error("Finance file save failed:", error);
            setStorageStatus("File save failed. Reconnect the Finance folder and save again.", false);
        });
}

async function restorePreviouslySelectedFolder() {
    try {
        directoryHandle = await loadDirectoryHandle();
        if (!directoryHandle) {
            setStorageStatus("Not connected — using browser storage.", false);
            return;
        }
        const permission = await directoryHandle.queryPermission({ mode: "readwrite" });
        if (permission !== "granted") {
            setStorageStatus("Finance folder found. Tap Connect Finance Folder to grant access again.", false);
            return;
        }
        financeFileHandle = await directoryHandle.getFileHandle("finance-data.json", { create: true });
        const restored = await readFinanceFile();
        setStorageStatus(restored
            ? "Connected — loaded Finance/finance-data.json"
            : "Connected — ready to save in Finance/finance-data.json", true);
    } catch (error) {
        console.warn("Could not restore Finance folder access:", error);
        setStorageStatus("Could not access the saved folder. Reconnect it to continue.", false);
        financeFileHandle = null;
    }
}

await restorePreviouslySelectedFolder();

const stored = JSON.parse(localStorage.getItem("transactions")) || [];
const unique = Array.from(new Map(stored.map(t => [t.id, t])).values());
localStorage.setItem("transactions", JSON.stringify(unique));

let state = { transactions: unique };
const currentMonthKey = new Date().toISOString().slice(0, 7);
let monthlyIncomes = JSON.parse(localStorage.getItem("monthlyIncomes") || "{}");
// Migrate the previous single fixed-income setting into the current month.
const legacyFixedIncome = Number(localStorage.getItem("fixedIncome")) || 0;
if (Object.keys(monthlyIncomes).length === 0 && legacyFixedIncome > 0) {
    monthlyIncomes[currentMonthKey] = legacyFixedIncome;
    localStorage.setItem("monthlyIncomes", JSON.stringify(monthlyIncomes));
    persistFinanceFile();
}
let selectedMonth = currentMonthKey;

function saveMonthlyIncomes() {
    localStorage.setItem("monthlyIncomes", JSON.stringify(monthlyIncomes));
}

function getTransactionsForMonth(month) {
    return state.transactions.filter(t => (t.date || "").slice(0, 7) === month);
}

function getMonthlyFigures(month = selectedMonth) {
    const monthTransactions = getTransactionsForMonth(month);
    const recordedIncome = monthTransactions
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const expense = monthTransactions
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const income = Number(monthlyIncomes[month]) > 0
        ? Number(monthlyIncomes[month])
        : recordedIncome;
    return { income, expense, balance: income - expense, transactions: monthTransactions };
}

function saveToStorage() {
    localStorage.setItem("transactions", JSON.stringify(state.transactions));
    persistFinanceFile();
}

const dashboardSection = document.getElementById("dashboardSection");
const transactionsSection = document.getElementById("transactionsSection");
const insightsSection = document.getElementById("insightsSection");

document.getElementById("navDashboard").onclick = () => showSection("dashboard");
document.getElementById("navTransactions").onclick = () => showSection("transactions");
document.getElementById("navInsights").onclick = () => showSection("insights");

function showSection(section) {
    dashboardSection.classList.add("hidden");
    transactionsSection.classList.add("hidden");
    insightsSection.classList.add("hidden");

    if (section === "dashboard") dashboardSection.classList.remove("hidden");
    if (section === "transactions") transactionsSection.classList.remove("hidden");
    if (section === "insights") insightsSection.classList.remove("hidden");
}

document.getElementById("addBtn").onclick = () => {
    const desc = document.getElementById("descInput").value.trim();
    const amount = Number(document.getElementById("amountInput").value);
    const date = document.getElementById("dateInput").value;
    const category = document.getElementById("categoryInput").value;
    const type = document.getElementById("typeInput").value;

    if (!desc || !amount || !date || !category || !type) {
        alert("Fill all fields");
        return;
    }

    if (amount <= 0) {
        alert("Amount must be greater than 0");
        return;
    }

    const duplicate = state.transactions.some(tx =>
        tx.desc === desc &&
        tx.amount === amount &&
        tx.date === date &&
        tx.category === category &&
        tx.type === type
    );

    if (duplicate) {
        alert("Duplicate transaction");
        return;
    }

    const newTransaction = {
        id: Date.now(),
        desc,
        amount,
        date,
        category,
        type
    };

    state.transactions.push(newTransaction);
    saveToStorage();
    ["descInput", "amountInput", "dateInput", "categoryInput"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("typeInput").value = "income";
    renderAll();
};

const tableBody = document.getElementById("transactionTable");
const emptyState = document.getElementById("emptyState");

function renderTable(list = state.transactions) {
    tableBody.innerHTML = "";

    if (list.length === 0) {
        emptyState.classList.remove("hidden");
        return;
    } else {
        emptyState.classList.add("hidden");
    }

    list.forEach(tx => {
        const row = `
        <tr>
            <td>${tx.date}</td>
            <td>${tx.desc}</td>
            <td>${tx.category}</td>
            <td>${tx.type}</td>
            <td>₹${tx.amount}</td>
            <td><button onclick="deleteTx(${tx.id})">Delete</button></td>
        </tr>`;
        tableBody.innerHTML += row;
    });
}

function deleteTx(id) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveToStorage();
    renderAll();
}

document.getElementById("searchInput").oninput = applyFilters;
document.getElementById("filterType").onchange = applyFilters;
document.getElementById("sortBy").onchange = applyFilters;

function applyFilters() {
    let list = [...state.transactions];

    const search = document.getElementById("searchInput").value.toLowerCase().trim();
    const typeFilter = document.getElementById("filterType").value;
    const sortBy = document.getElementById("sortBy").value;

    if (search) {
        list = list.filter(tx => tx.desc.toLowerCase().includes(search));
    }

    if (typeFilter !== "all") {
        list = list.filter(tx => tx.type === typeFilter);
    }

    if (sortBy === "amount") {
        list.sort((a, b) => b.amount - a.amount);
    } else {
        list.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    renderTable(list);
}

function calculateSummary() {
    const { income, expense, balance } = getMonthlyFigures();
    document.getElementById("totalIncome").innerText = "₹" + income.toLocaleString("en-IN");
    document.getElementById("totalExpense").innerText = "₹" + expense.toLocaleString("en-IN");
    document.getElementById("totalBalance").innerText = "₹" + balance.toLocaleString("en-IN");
    document.getElementById("summaryMonthLabel").innerText = new Date(selectedMonth + "-01T00:00:00")
        .toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function calculateInsights() {
    const { income, expense, transactions } = getMonthlyFigures();
    if (transactions.length === 0) {
        document.getElementById("topCategory").innerText = "-";
        document.getElementById("savingsRate").innerText = income > 0 ? "100%" : "0%";
        return;
    }

    const categories = {};
    transactions.filter(t => t.type === "expense").forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + Number(t.amount);
    });

    const topCategory = Object.keys(categories).length
        ? Object.keys(categories).reduce((a, b) => categories[a] > categories[b] ? a : b)
        : "-";
    const savingsRate = income ? ((income - expense) / income * 100).toFixed(1) : 0;
    document.getElementById("topCategory").innerText = topCategory;
    document.getElementById("savingsRate").innerText = savingsRate + "%";
}

let monthlyChart, categoryChart;

function renderCharts() {
    const ctx1 = document.getElementById("monthlyChart");
    const ctx2 = document.getElementById("categoryChart");

    if (monthlyChart) monthlyChart.destroy();
    if (categoryChart) categoryChart.destroy();

    monthlyChart = new Chart(ctx1, {
        type: "line",
        data: {
            labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
            datasets: [{
                label: "Balance Trend",
                data: [5000, 8000, 6000, 9000, 7000, 10000],
                borderColor: "#4ade80",
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    categoryChart = new Chart(ctx2, {
        type: "pie",
        data: {
            labels: ["Food", "Shopping", "Travel"],
            datasets: [{
                data: [3000, 2000, 1500],
                backgroundColor: ["#f87171", "#60a5fa", "#34d399"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function renderAll() {
    renderTable();
    calculateSummary();
    calculateInsights();
    renderCharts();
    applyFilters();
}


// Monthly income settings: each month keeps its own saved amount.
const incomeMonthInput = document.getElementById("incomeMonthInput");
const monthlyIncomeInput = document.getElementById("monthlyIncomeInput");
const saveIncomeBtn = document.getElementById("saveIncomeBtn");

function syncIncomeEditor() {
    incomeMonthInput.value = selectedMonth;
    monthlyIncomeInput.value = monthlyIncomes[selectedMonth] ?? "";
}
incomeMonthInput.value = selectedMonth;
syncIncomeEditor();

incomeMonthInput.addEventListener("change", () => {
    if (!incomeMonthInput.value) return;
    selectedMonth = incomeMonthInput.value;
    syncIncomeEditor();
    renderAll();
});

saveIncomeBtn.addEventListener("click", () => {
    const amount = Number(monthlyIncomeInput.value);
    if (!Number.isFinite(amount) || amount <= 0) {
        alert("Enter a valid monthly income greater than 0");
        return;
    }
    monthlyIncomes[selectedMonth] = amount;
    saveMonthlyIncomes();
    renderAll();
    alert("Income saved for " + selectedMonth);
});

// Mobile navigation drawer
const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menuToggle");
const sidebarOverlay = document.getElementById("sidebarOverlay");

function setSidebarOpen(open) {
    if (!sidebar || !menuToggle || !sidebarOverlay) return;
    sidebar.classList.toggle("is-open", open);
    document.body.classList.toggle("sidebar-open", open);
    sidebarOverlay.hidden = !open;
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
}

menuToggle?.addEventListener("click", () => {
    setSidebarOpen(menuToggle.getAttribute("aria-expanded") !== "true");
});
sidebarOverlay?.addEventListener("click", () => setSidebarOpen(false));
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setSidebarOpen(false);
});
[["navDashboard", "dashboard"], ["navTransactions", "transactions"], ["navInsights", "insights"]]
    .forEach(([id, section]) => {
        document.getElementById(id)?.addEventListener("click", () => {
            showSection(section);
            setSidebarOpen(false);
        });
    });

// // Local device file storage controls.
document.getElementById("connectFolderBtn").addEventListener("click", async () => {
    if (!("showDirectoryPicker" in window)) {
        setStorageStatus("Folder access is not supported by this browser. Use Export Backup.", false);
        alert("This browser does not support direct folder access. Your data remains in browser storage; use Export Backup to save a JSON copy.");
        return;
    }
    try {
        directoryHandle = await window.showDirectoryPicker({ id: "finance-dashboard-folder", mode: "readwrite" });
        const permission = await directoryHandle.requestPermission({ mode: "readwrite" });
        if (permission !== "granted") throw new Error("Write permission was not granted.");
        financeFileHandle = await directoryHandle.getFileHandle("finance-data.json", { create: true });
        const restored = await readFinanceFile();
        if (restored) {
            state.transactions = JSON.parse(localStorage.getItem("transactions") || "[]");
            monthlyIncomes = JSON.parse(localStorage.getItem("monthlyIncomes") || "{}");
            selectedMonth = currentMonthKey;
            syncIncomeEditor();
            renderAll();
        } else {
            await writeFinanceFile();
        }
        await saveDirectoryHandle(directoryHandle);
        setStorageStatus("Connected — Finance/finance-data.json", true);
        alert(restored ? "Finance folder connected. Existing data was loaded from finance-data.json." : "Finance folder connected. Existing dashboard data was saved to finance-data.json.");
    } catch (error) {
        if (error.name !== "AbortError") {
            console.error(error);
            setStorageStatus("Folder connection failed. Browser storage remains available.", false);
            alert("Could not connect the Finance folder: " + error.message);
        }
    }
});

document.getElementById("saveFileNowBtn").addEventListener("click", async () => {
    if (!financeFileHandle) { alert("Connect your Finance folder first."); return; }
    try { await writeFinanceFile(); alert("Finance data saved to finance-data.json."); }
    catch (error) { setStorageStatus("File save failed. Reconnect the folder and try again.", false); alert("Could not save the file: " + error.message); }
});

document.getElementById("exportBackupBtn").addEventListener("click", () => {
    const payload = { version: 1, exportedAt: new Date().toISOString(), transactions: state.transactions, monthlyIncomes };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "finance-backup.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
});

Role-switch UI is not present in this page, so do not call the undefined applyRoleUI().
renderAll();
})();
