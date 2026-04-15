# Finance-Dashboard-UI
**Finance Dashboard UI**

A responsive and interactive Finance Dashboard built using HTML, CSS, and Vanilla JavaScript.
This project simulates a simple personal finance tracker where users can view financial summaries, manage transactions, and gain spending insights.

This project was built as a frontend assignment to demonstrate UI design, state management, and client-side data handling without any backend.

**Live Demo**

You can deploy using GitHub Pages after uploading the repo.

**Features**
**Dashboard Overview**
Total Balance, Income, Expenses summary cards
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

**Local Storage Persistence**

All data is saved in browser storage so it remains after refresh.

**Tech Stack**
HTML5
CSS3 (Flexbox + Grid)
JavaScript (ES6)  
Chart.js (for charts)
LocalStorage (for persistence)

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
Responsive layout for desktop and tablet screens

**Future Scope**
Dark mode toggle
CSV export
Monthly filtering
Category management
Real backend integration

**Author**

Siriki Sai Dhanush

GitHub: https://github.com/dhanush7331
