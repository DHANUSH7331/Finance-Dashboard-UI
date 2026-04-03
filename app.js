const stored = JSON.parse(localStorage.getItem("transactions")) || [];
const unique = Array.from(new Map(stored.map(t => [t.id, t])).values());
localStorage.setItem("transactions", JSON.stringify(unique));

let state = {
    role: "viewer",
    transactions: unique
};

function saveToStorage() {
    localStorage.setItem("transactions", JSON.stringify(state.transactions));
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

const roleSelect = document.getElementById("roleSelect");
const transactionForm = document.getElementById("transactionForm");

roleSelect.onchange = () => {
    state.role = roleSelect.value;
    applyRoleUI();
    renderTable();
};

function applyRoleUI() {
    transactionForm.style.display = state.role === "viewer" ? "none" : "flex";
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
    document.getElementById("transactionForm").reset();
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
            <td>${state.role === "admin" ? `<button onclick="deleteTx(${tx.id})">Delete</button>` : ""}</td>
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
    let income = 0;
    let expense = 0;

    state.transactions.forEach(t => {
        if (t.type === "income") income += t.amount;
        else if (t.type === "expense") expense += t.amount;
    });

    const balance = income - expense;

    document.getElementById("totalIncome").innerText = "₹" + income;
    document.getElementById("totalExpense").innerText = "₹" + expense;
    document.getElementById("totalBalance").innerText = "₹" + balance;
}

function calculateInsights() {
    if (state.transactions.length === 0) {
        document.getElementById("topCategory").innerText = "-";
        document.getElementById("savingsRate").innerText = "0%";
        return;
    }

    const categories = {};
    let income = 0;
    let expense = 0;

    state.transactions.forEach(t => {
        if (t.type === "expense") {
            categories[t.category] = (categories[t.category] || 0) + t.amount;
            expense += t.amount;
        } else if (t.type === "income") {
            income += t.amount;
        }
    });

    let topCategory = "-";
    if (Object.keys(categories).length > 0) {
        topCategory = Object.keys(categories).reduce((a, b) =>
            categories[a] > categories[b] ? a : b
        );
    }

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

applyRoleUI();
renderAll();