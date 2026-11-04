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

async function saveStoredHandle(handle, key) {
    const db = await openHandleDatabase();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(HANDLE_STORE, "readwrite");
        tx.objectStore(HANDLE_STORE).put(handle, key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error("Could not save the file permission handle."));
    });
    db.close();
}

async function loadStoredHandle(key) {
    const db = await openHandleDatabase();
    const handle = await new Promise((resolve, reject) => {
        const tx = db.transaction(HANDLE_STORE, "readonly");
        const request = tx.objectStore(HANDLE_STORE).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
    db.close();
    return handle;
}

const saveDirectoryHandle = handle => saveStoredHandle(handle, "finance-folder");
const loadDirectoryHandle = () => loadStoredHandle("finance-folder");
const saveFileHandle = handle => saveStoredHandle(handle, "finance-file");
const loadFileHandle = () => loadStoredHandle("finance-file");

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
        if (directoryHandle) {
            const permission = await directoryHandle.queryPermission({ mode: "readwrite" });
            if (permission === "granted") {
                financeFileHandle = await directoryHandle.getFileHandle("finance-data.json", { create: true });
                const restored = await readFinanceFile();
                if (restored) {
                    state.transactions = JSON.parse(localStorage.getItem("transactions") || "[]");
                    monthlyIncomes = JSON.parse(localStorage.getItem("monthlyIncomes") || "{}");
                    selectedMonth = currentMonthKey;
                    syncIncomeEditor();
                    renderAll();
                }
                setStorageStatus(restored
                    ? "Connected — loaded Finance/finance-data.json"
                    : "Connected — ready to save in Finance/finance-data.json", true);
                return;
            }
        }

        const savedFileHandle = await loadFileHandle();
        if (savedFileHandle) {
            const permission = await savedFileHandle.queryPermission({ mode: "readwrite" });
            if (permission === "granted") {
                financeFileHandle = savedFileHandle;
                const restored = await readFinanceFile();
                if (restored) {
                    state.transactions = JSON.parse(localStorage.getItem("transactions") || "[]");
                    monthlyIncomes = JSON.parse(localStorage.getItem("monthlyIncomes") || "{}");
                    selectedMonth = currentMonthKey;
                    syncIncomeEditor();
                    renderAll();
                }
                setStorageStatus(restored
                    ? "Connected — loaded finance-data.json"
                    : "Connected — ready to save finance-data.json", true);
                return;
            }
        }

        setStorageStatus(
            directoryHandle || savedFileHandle
                ? "Storage location remembered. Tap Connect Finance Folder to grant access again."
                : "Not connected — using browser storage until you select a Finance folder.",
            false
        );
    } catch (error) {
        console.warn("Could not restore Finance file access:", error);
        setStorageStatus("Could not reconnect the saved location. Tap Connect Finance Folder.", false);
        financeFileHandle = null;
    }
}


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
    persistFinanceFile();
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
    emptyState.classList.toggle("hidden", list.length > 0);
    list.forEach(tx => {
        const row = document.createElement("tr");
        [tx.date, tx.desc, tx.category, tx.type, "₹" + Number(tx.amount).toLocaleString("en-IN")].forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value == null ? "" : String(value);
            row.appendChild(cell);
        });
        const actionCell = document.createElement("td");
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.dataset.deleteId = String(tx.id);
        actionCell.appendChild(deleteButton);
        row.appendChild(actionCell);
        tableBody.appendChild(row);
    });
}

function deleteTx(id) {
    state.transactions = state.transactions.filter(t => String(t.id) !== String(id));
    saveToStorage();
    renderAll();
}
tableBody.addEventListener("click", event => {
    const button = event.target.closest("button[data-delete-id]");
    if (button) deleteTx(button.dataset.deleteId);
});

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

function prepareChartCanvas(canvas, height = 280) {
    if (!canvas) return null;
    const width = Math.max(280, Math.floor(canvas.getBoundingClientRect().width || 600));
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    canvas.style.width = "100%";
    canvas.style.height = height + "px";
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    return { context, width, height };
}

function drawBalanceChart(canvas) {
    const surface = prepareChartCanvas(canvas);
    if (!surface) return;
    const { context: ctx, width, height } = surface;
    const months = [];
    const now = new Date();
    for (let offset = 5; offset >= 0; offset--) {
        const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const key = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
        months.push({ label: date.toLocaleDateString("en-IN", { month: "short" }), balance: getMonthlyFigures(key).balance });
    }
    const left = 54, right = width - 16, top = 34, bottom = height - 42;
    const values = months.map(item => item.balance);
    const min = Math.min(0, ...values), max = Math.max(1, ...values), range = Math.max(1, max - min);
    ctx.fillStyle = "#111827"; ctx.font = "bold 14px Arial"; ctx.fillText("Monthly balance", 16, 20);
    ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1; ctx.fillStyle = "#6b7280"; ctx.font = "11px Arial";
    for (let tick = 0; tick <= 4; tick++) {
        const y = top + (bottom - top) * tick / 4;
        ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
        ctx.fillText("₹" + Math.round(max - range * tick / 4).toLocaleString("en-IN"), 3, y + 4);
    }
    const points = months.map((item, index) => ({
        x: left + (right - left) * index / (months.length - 1),
        y: bottom - ((item.balance - min) / range) * (bottom - top)
    }));
    ctx.strokeStyle = "#16a34a"; ctx.lineWidth = 3; ctx.beginPath();
    points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.stroke();
    points.forEach((point, index) => {
        ctx.fillStyle = "#16a34a"; ctx.beginPath(); ctx.arc(point.x, point.y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#6b7280"; ctx.textAlign = "center"; ctx.fillText(months[index].label, point.x, height - 18);
    });
    ctx.textAlign = "start";
}

function drawCategoryChart(canvas) {
    const surface = prepareChartCanvas(canvas);
    if (!surface) return;
    const { context: ctx, width, height } = surface;
    const totals = {};
    getTransactionsForMonth(selectedMonth).filter(tx => tx.type === "expense").forEach(tx => {
        const category = tx.category || "Other";
        totals[category] = (totals[category] || 0) + Number(tx.amount || 0);
    });
    const items = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const colors = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#0d9488"];
    ctx.fillStyle = "#111827"; ctx.font = "bold 14px Arial"; ctx.fillText("Expense categories", 16, 20);
    if (!items.length) {
        ctx.fillStyle = "#6b7280"; ctx.font = "13px Arial"; ctx.textAlign = "center";
        ctx.fillText("No expense transactions for this month yet", width / 2, height / 2);
        ctx.textAlign = "start"; return;
    }
    const total = items.reduce((sum, item) => sum + item[1], 0);
    const centerX = width * .32, centerY = height * .55, radius = Math.min(78, height * .29);
    let angle = -Math.PI / 2;
    items.forEach((item, index) => {
        const slice = item[1] / total * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.arc(centerX, centerY, radius, angle, angle + slice);
        ctx.closePath(); ctx.fillStyle = colors[index % colors.length]; ctx.fill(); angle += slice;
    });
    ctx.font = "12px Arial";
    items.forEach((item, index) => {
        const y = 58 + index * 31;
        ctx.fillStyle = colors[index % colors.length]; ctx.fillRect(width * .58, y - 10, 11, 11);
        ctx.fillStyle = "#374151";
        const label = item[0].length > 16 ? item[0].slice(0, 15) + "…" : item[0];
        ctx.fillText(label + " · ₹" + item[1].toLocaleString("en-IN"), width * .58 + 18, y);
    });
}

function renderCharts() {
    drawBalanceChart(document.getElementById("monthlyChart"));
    drawCategoryChart(document.getElementById("categoryChart"));
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
window.addEventListener("resize", () => {
    if (window.innerWidth > 900) setSidebarOpen(false);
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

// Local device file storage controls.
async function finishFileConnection(restored, storageLabel) {
    if (restored) {
        state.transactions = JSON.parse(localStorage.getItem("transactions") || "[]");
        monthlyIncomes = JSON.parse(localStorage.getItem("monthlyIncomes") || "{}");
        selectedMonth = currentMonthKey;
        syncIncomeEditor();
        renderAll();
    } else {
        await writeFinanceFile();
    }
    setStorageStatus("Connected — " + storageLabel, true);
    alert(restored
        ? "Your saved finance data has been loaded."
        : "Your existing dashboard data has been saved to the selected location.");
}

document.getElementById("connectFolderBtn").addEventListener("click", async () => {
    try {
        if (!window.isSecureContext) {
            throw new Error("Direct file access requires a secure HTTPS connection. Open the deployed HTTPS dashboard.");
        }

        if ("showDirectoryPicker" in window) {
            // The picker itself requests read/write access. Do not trigger a second prompt here.
            directoryHandle = await window.showDirectoryPicker({
                id: "finance-dashboard-folder",
                mode: "readwrite"
            });
            financeFileHandle = await directoryHandle.getFileHandle("finance-data.json", { create: true });
            await saveDirectoryHandle(directoryHandle);
            const restored = await readFinanceFile();
            await finishFileConnection(restored, "Finance/finance-data.json");
            return;
        }

        // Some browsers expose file saving but not folder selection. Let the user
        // choose finance-data.json inside their Finance folder as a practical fallback.
        if ("showSaveFilePicker" in window) {
            financeFileHandle = await window.showSaveFilePicker({
                suggestedName: "finance-data.json",
                types: [{
                    description: "Finance data",
                    accept: { "application/json": [".json"] }
                }]
            });
            await saveFileHandle(financeFileHandle);
            directoryHandle = null;
            const restored = await readFinanceFile();
            await finishFileConnection(restored, "finance-data.json");
            return;
        }

        const folderInput = document.getElementById("financeFolderInput");
        if ("webkitdirectory" in folderInput) {
            setStorageStatus("Choose your Finance folder. On this browser, folder access is import-only; use Save File Now to download updates.", false);
            folderInput.click();
            return;
        }

        setStorageStatus("This browser cannot open a writable folder. You can import a JSON file or export a backup.", false);
        document.getElementById("financeJsonInput").click();
    } catch (error) {
        if (error.name !== "AbortError") {
            console.error("Finance location connection failed:", error);
            setStorageStatus("Could not connect the selected location. Browser storage is still active.", false);
            alert("Could not connect the Finance folder/file: " + (error.message || error));
        }
    }
});

function downloadJsonFile(fileName, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

document.getElementById("saveFileNowBtn").addEventListener("click", async () => {
    if (!financeFileHandle) {
        downloadJsonFile("finance-data.json", currentFinanceData());
        setStorageStatus("Downloaded finance-data.json. Move it into your Finance folder using your phone's Files app.", false);
        return;
    }
    try {
        await writeFinanceFile();
        alert("Finance data saved successfully.");
    } catch (error) {
        setStorageStatus("File save failed. Reconnect the folder and try again.", false);
        alert("Could not save the file: " + (error.message || error));
    }
});

document.getElementById("exportBackupBtn").addEventListener("click", () => {
    downloadJsonFile("finance-backup.json", {
        version: 1,
        exportedAt: new Date().toISOString(),
        transactions: state.transactions,
        monthlyIncomes
    });
});

// Mobile browsers without writable file handles can select a folder for import.
const financeFolderInput = document.getElementById("financeFolderInput");
financeFolderInput.addEventListener("change", async () => {
    const selectedFiles = Array.from(financeFolderInput.files || []);
    const dataFile = selectedFiles.find(file => file.name.toLowerCase() === "finance-data.json");
    if (!selectedFiles.length) return;

    if (!dataFile) {
        setStorageStatus("Folder selected, but finance-data.json was not found. Use Save File Now to create a file, then move it into this folder with your Files app.", false);
        alert("The selected folder does not contain finance-data.json yet. Use Save File Now, then move the downloaded file into the Finance folder using your Files app.");
        financeFolderInput.value = "";
        return;
    }

    try {
        const imported = JSON.parse(await dataFile.text());
        applyFileData(imported);
        state.transactions = JSON.parse(localStorage.getItem("transactions") || "[]");
        monthlyIncomes = JSON.parse(localStorage.getItem("monthlyIncomes") || "{}");
        selectedMonth = currentMonthKey;
        syncIncomeEditor();
        renderAll();
        setStorageStatus("Loaded from selected Finance folder. This browser cannot auto-write back; use Save File Now after edits.", false);
        alert("Finance data loaded. After making changes, tap Save File Now and move the downloaded finance-data.json into the Finance folder, replacing the old file.");
    } catch (error) {
        setStorageStatus("Could not read finance-data.json from that folder.", false);
        alert("Could not import finance-data.json: " + (error.message || error));
    }
    financeFolderInput.value = "";
});

document.getElementById("financeJsonInput").addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
        const imported = JSON.parse(await file.text());
        applyFileData(imported);
        state.transactions = JSON.parse(localStorage.getItem("transactions") || "[]");
        monthlyIncomes = JSON.parse(localStorage.getItem("monthlyIncomes") || "{}");
        selectedMonth = currentMonthKey;
        syncIncomeEditor();
        renderAll();
        setStorageStatus("Imported JSON file. Export after edits to keep an external copy.", false);
        alert("Finance data imported successfully.");
    } catch (error) {
        alert("Could not import this JSON file: " + (error.message || error));
    }
    event.target.value = "";
});

// Role-switch UI is not present in this page, so do not call the undefined applyRoleUI().
renderAll();
restorePreviouslySelectedFolder().catch(error => {
    console.warn("Finance file restore skipped:", error);
    setStorageStatus("Using browser storage. Reconnect your Finance folder when needed.", false);
});
window.addEventListener("resize", () => {
    if (dashboardSection && !dashboardSection.classList.contains("hidden")) renderCharts();
});
})();
