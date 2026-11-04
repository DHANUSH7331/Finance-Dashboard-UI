# Finance-Dashboard-UI
**Vesper — Finance Dashboard UI**

A responsive, animated personal finance dashboard with a premium dark fintech interface, native canvas charts, month-by-month income management, local persistence and offline app-shell caching.
This project simulates a simple personal finance tracker where users can view financial summaries, manage transactions, and gain spending insights.

This project was built as a frontend assignment to demonstrate UI design, state management, and client-side data handling without any backend.

**Live Demo**

You can deploy using GitHub Pages after uploading the repo.

**Features**
**Dashboard Overview**
Total Balance, Income, Expenses summary cards
Set and save a separate income amount for each month from the Dashboard
Monthly income history is stored in the browser until a device Finance folder is connected; changing one month does not overwrite another
Monthly balance is calculated as that month’s income minus that month’s recorded expenses
Balance trend line chart
Spending breakdown pie chart
<img width="1919" height="936" alt="Screenshot 2026-04-03 132736" src="https://github.com/user-attachments/assets/a1cd66cd-c5ec-4628-97f8-95f162b5206b" />
<img width="1919" height="943" alt="Screenshot 2026-04-03 132742" src="https://github.com/user-attachments/assets/5e2f4dbf-5656-409e-9598-b36cd177764f" />

**Transactions Section**
Add new transactions (Admin role)
View transactions (Viewer role)
Search transactions
Filter by type (Income / Expense)
Sort by date or amount
Delete transactions (Admin only)
Empty state handling
<img width="1919" height="948" alt="Screenshot 2026-04-03 132853" src="https://github.com/user-attachments/assets/2675e132-073f-4e8d-847c-efec89f9e8ee" />

**Role-Based UI (Frontend Simulation)**
Viewer
Can view dashboard and transactions
Cannot add or delete data
Admin
Can add new transactions
Can delete transactions

Role can be switched using dropdown for demo purposes.

<img width="326" height="946" alt="Screenshot 2026-04-03 132925" src="https://github.com/user-attachments/assets/4d8c8787-e9df-4113-abd6-902174945192" />

**Insights Section**
Highest spending category
Savings rate calculation
Automatic updates based on transactions
<img width="1919" height="949" alt="Screenshot 2026-04-03 133041" src="https://github.com/user-attachments/assets/d77a3f02-57b1-4296-9bed-7e59c3025256" />

**Local and Device File Storage**

By default, transactions and monthly income are saved in browser LocalStorage. On supported Chromium browsers, use **Connect Finance Folder** to choose or create a Finance folder on the device. The app then reads and automatically writes `finance-data.json` in that folder after transactions or monthly income change. On mobile browsers that do not expose writable folder handles, the directory picker can be used to import an existing `finance-data.json`, but it cannot grant write access. After edits, tap **Save File Now** to download a fresh `finance-data.json`, then move/replace it in the Finance folder using the device Files app. Direct automatic folder writes are available only in browsers that implement the File System Access API. The selected folder handle is retained in IndexedDB so the app can try to reconnect on later visits; the browser may still require permission to be granted again. Use **Save File Now** to manually retry a save, or **Export Backup** to download a portable JSON backup. If folder access is unavailable or permission is denied, the app continues using browser storage. On the Dashboard, use the **Set Monthly Income** panel: choose a month, enter the income for that month, and click **Save Monthly Income**. To change income later, select that month again, enter the revised amount, and save. Each month has its own saved amount, so changing February does not change January. The summary cards show the selected month’s income, expenses, and available balance (income minus expenses). If no monthly income has been set for a month, its income transactions are used as a fallback.

**Tech Stack**
HTML5
CSS3 (Flexbox + Grid)
JavaScript (ES6)  
Chart.js (for charts)
LocalStorage fallback, IndexedDB (saved folder handle), and File System Access API (device JSON file)

**Project Structure**
Finance-Dashboard/

│

├── index.html

├── style.css

├── app.js

└── README.md

**How to Run Locally**
Download or clone the repository
git clone https://github.com/yourusername/finance-dashboard.git
Open the project folder
Open index.html in your browser

**Design Decisions**
Single page application approach for simplicity
State managed using a central JavaScript object
LocalStorage used instead of backend for persistence
Role-based UI simulated for demonstration
Charts added to improve financial visualization
Responsive layout for desktop, tablet, and mobile screens
Mobile navigation drawer with hamburger menu
Month-by-month income history with editable monthly amounts
Monthly expense totals and available balance

**Future Scope**
Dark mode toggle
CSV export
Monthly filtering
Category management
Real backend integration

**Author**

Siriki Sai Dhanush

GitHub: https://github.com/dhanush7331


**Vesper UI refresh**

The interface uses a deep navy visual system with violet/blue accents, animated KPI counters, animated native canvas analytics, responsive navigation, transaction search/filter/sort controls, and reduced-motion accessibility. Core data keys and existing finance features are retained.
