const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection with robust error handling for Serverless
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.warn('WARNING: MONGODB_URI is not defined. Backend will not function correctly.');
} else {
    mongoose.connect(MONGODB_URI)
      .then(() => console.log('Connected to MongoDB Atlas'))
      .catch(err => console.error('MongoDB connection error:', err));
}

// Loan Schema
const loanSchema = new mongoose.Schema({
    id: String,
    name: { type: String, required: true },
    phone: { type: String, required: true },
    weight: Number,
    purity: String,
    amount: Number,
    interest: Number,
    date: { type: Date, default: Date.now },
    dueDate: Date,
    status: { type: String, default: 'Active' },
    releasedDate: Date,
    finalInterest: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 }
});

const Loan = mongoose.model('Loan', loanSchema);

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

// API Routes
app.get('/api/loans', async (req, res) => {
    try {
        if (!mongoose.connection.readyState) throw new Error('Database not connected');
        const loans = await Loan.find().sort({ date: -1 });
        res.json(loans);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/loans', async (req, res) => {
    try {
        if (!mongoose.connection.readyState) throw new Error('Database not connected');
        const { name, phone, weight, purity, amount, interest, date } = req.body;
        
        const lastLoan = await Loan.findOne().sort({ id: -1 });
        const lastIdNum = lastLoan && lastLoan.id ? parseInt(lastLoan.id.split('-')[1]) : 1000;
        const nextId = `L-${lastIdNum + 1}`;

        const loanDate = date ? new Date(date) : new Date();
        const dueDate = new Date(loanDate);
        dueDate.setFullYear(dueDate.getFullYear() + 1);

        const newLoan = new Loan({
            id: nextId,
            name, phone, weight, purity, amount, interest,
            date: loanDate,
            dueDate: dueDate
        });

        const savedLoan = await newLoan.save();
        res.status(201).json(savedLoan);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/loans/:id/release', async (req, res) => {
    try {
        if (!mongoose.connection.readyState) throw new Error('Database not connected');
        const loan = await Loan.findOne({ id: req.params.id });
        if (!loan) return res.status(404).json({ message: 'Loan not found' });
        if (loan.status === 'Closed') return res.status(400).json({ message: 'Loan already closed' });

        const releasedDate = new Date();
        const interestAmount = calculateInterest(loan.amount, loan.interest, loan.date, releasedDate);
        
        loan.status = 'Closed';
        loan.releasedDate = releasedDate;
        loan.finalInterest = interestAmount;
        loan.totalPaid = loan.amount + interestAmount;

        const updatedLoan = await loan.save();
        res.json(updatedLoan);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        if (!mongoose.connection.readyState) throw new Error('Database not connected');
        const loans = await Loan.find();
        const activeLoans = loans.filter(l => l.status === 'Active');
        const closedLoans = loans.filter(l => l.status === 'Closed');

        const totalGoldReceived = loans.reduce((sum, l) => sum + (l.weight || 0), 0);
        const goldInStore = activeLoans.reduce((sum, l) => sum + (l.weight || 0), 0);
        const goldReleased = closedLoans.reduce((sum, l) => sum + (l.weight || 0), 0);
        const totalActiveLoanAmount = activeLoans.reduce((sum, l) => sum + (l.amount || 0), 0);

        res.json({
            totalLoans: loans.length,
            activeLoansCount: activeLoans.length,
            closedLoansCount: closedLoans.length,
            totalGoldReceived: totalGoldReceived.toFixed(2),
            goldInStore: goldInStore.toFixed(2),
            goldReleased: goldReleased.toFixed(2),
            totalActiveLoanAmount: totalActiveLoanAmount.toFixed(2)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve Static Files for Production
const publicPath = path.join(__dirname, '../client/dist');
app.use(express.static(publicPath));

// Fallback to React app
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// For Vercel, we export the app
module.exports = app;
