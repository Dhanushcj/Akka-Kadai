const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(bodyParser.json());

// Initialize data.json if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ loans: [], lastId: 1000 }, null, 2));
}

// Utility to read data
const readData = () => {
    const data = fs.readFileSync(DATA_FILE);
    return JSON.parse(data);
};

// Utility to write data
const writeData = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// Helper: Calculate interest
const calculateInterest = (amount, rate, startDate, endDate = new Date()) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const monthlyRate = rate / 100;
    const months = diffDays / 30;
    const interest = amount * monthlyRate * months;
    
    return parseFloat(interest.toFixed(2));
};

// Serve Static Files for Production
app.use(express.static(path.join(__dirname, '../client/dist')));

// API Routes
app.get('/api/loans', (req, res) => {
    const data = readData();
    res.json(data.loans);
});

app.post('/api/loans', (req, res) => {
    const data = readData();
    const { name, phone, weight, purity, amount, interest, date } = req.body;
    
    const lastId = data.lastId + 1;
    const loanDate = date ? new Date(date) : new Date();
    const dueDate = new Date(loanDate);
    dueDate.setFullYear(dueDate.getFullYear() + 1);

    const newLoan = {
        id: `L-${lastId}`,
        name,
        phone,
        weight: parseFloat(weight),
        purity,
        amount: parseFloat(amount),
        interest: parseFloat(interest),
        date: loanDate.toISOString(),
        dueDate: dueDate.toISOString(),
        status: 'Active',
        releasedDate: null,
        finalInterest: 0,
        totalPaid: 0
    };

    data.loans.push(newLoan);
    data.lastId = lastId;
    writeData(data);
    res.status(201).json(newLoan);
});

app.put('/api/loans/:id/release', (req, res) => {
    const data = readData();
    const loanIndex = data.loans.findIndex(l => l.id === req.params.id);

    if (loanIndex === -1) return res.status(404).json({ message: 'Loan not found' });

    const loan = data.loans[loanIndex];
    if (loan.status === 'Closed') return res.status(400).json({ message: 'Loan already closed' });

    const releasedDate = new Date();
    const interestAmount = calculateInterest(loan.amount, loan.interest, loan.date, releasedDate);
    
    loan.status = 'Closed';
    loan.releasedDate = releasedDate.toISOString();
    loan.finalInterest = interestAmount;
    loan.totalPaid = loan.amount + interestAmount;

    writeData(data);
    res.json(loan);
});

app.get('/api/stats', (req, res) => {
    const data = readData();
    const activeLoans = data.loans.filter(l => l.status === 'Active');
    const closedLoans = data.loans.filter(l => l.status === 'Closed');

    const totalGoldReceived = data.loans.reduce((sum, l) => sum + l.weight, 0);
    const goldInStore = activeLoans.reduce((sum, l) => sum + l.weight, 0);
    const goldReleased = closedLoans.reduce((sum, l) => sum + l.weight, 0);
    const totalActiveLoanAmount = activeLoans.reduce((sum, l) => sum + l.amount, 0);

    res.json({
        totalLoans: data.loans.length,
        activeLoansCount: activeLoans.length,
        closedLoansCount: closedLoans.length,
        totalGoldReceived: totalGoldReceived.toFixed(2),
        goldInStore: goldInStore.toFixed(2),
        goldReleased: goldReleased.toFixed(2),
        totalActiveLoanAmount: totalActiveLoanAmount.toFixed(2)
    });
});

// Fallback to React app for non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const ACT_PORT = process.env.PORT || 5000;
app.listen(ACT_PORT, () => {
    console.log(`Server running at http://localhost:${ACT_PORT}`);
});
