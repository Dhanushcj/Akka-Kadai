const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gold-shop';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// Loan Schema
const loanSchema = new mongoose.Schema({
    id: String,
    name: { type: String, required: true },
    phone: { type: String, required: true },
    weight: Number,
    stoneWastage: { type: Number, default: 0 },
    purity: String,
    ornamentType: { type: String, default: 'Necklace' },
    amount: Number,
    interest: Number,
    date: { type: Date, default: Date.now },
    dueDate: Date,
    status: { type: String, default: 'Active' },
    releasedDate: Date,
    finalInterest: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    goldPhoto: { type: String, default: null },
    customerPhoto: { type: String, default: null },
    payments: [{
        paymentId: String,
        date: { type: Date, default: Date.now },
        amount: Number,
        description: { type: String, default: 'Interest Payment' }
    }]
});

const Loan = mongoose.model('Loan', loanSchema);

// Settings Schema
const settingsSchema = new mongoose.Schema({
    id: { type: String, default: 'global' },
    password: { type: String, default: 'admin123' },
    ratePerGram: { type: Number, default: 7000 }
});
const Settings = mongoose.model('Settings', settingsSchema);

// Helper: Calculate interest
const calculateInterest = (amount, rate, startDate, endDate = new Date()) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) return 0;
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // (Amount * (Rate * 12 / 100)) / 365 -> Round -> Multiply by Days
    const dailyInterest = Math.round((amount * (rate * 12 / 100)) / 365);
    return dailyInterest * diffDays;
};

const getLoanState = (loan, targetDate = new Date()) => {
    let currentPrincipal = loan.amount;
    let interestDue = 0;
    let lastEventDate = new Date(loan.date);
    
    // Sort payments by date
    const sortedPayments = [...(loan.payments || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    for (const payment of sortedPayments) {
        const payDate = new Date(payment.date);
        if (payDate > targetDate) break;
        
        // Calculate interest accrued until this payment
        const accrued = calculateInterest(currentPrincipal, loan.interest, lastEventDate, payDate);
        interestDue += accrued;
        
        // Apply payment: Interest first, then Principal
        if (payment.amount >= interestDue) {
            const principalReduction = payment.amount - interestDue;
            interestDue = 0;
            currentPrincipal = Math.max(0, currentPrincipal - principalReduction);
        } else {
            interestDue -= payment.amount;
        }
        
        lastEventDate = payDate;
    }
    
    // Calculate final interest from last event to target date
    const finalAccrued = calculateInterest(currentPrincipal, loan.interest, lastEventDate, targetDate);
    interestDue += finalAccrued;
    
    return {
        currentPrincipal: parseFloat(currentPrincipal.toFixed(2)),
        interestDue: parseFloat(interestDue.toFixed(2)),
        outstanding: parseFloat((currentPrincipal + interestDue).toFixed(2))
    };
};

// Serve Static Files for Production
app.use(express.static(path.join(__dirname, '../client/dist')));

// API Routes
app.post('/api/login', async (req, res) => {
    try {
        let settings = await Settings.findOne({ id: 'global' });
        if (!settings) settings = await (new Settings({})).save();
        
        if (req.body.password === settings.password) {
            res.json({ success: true, ratePerGram: settings.ratePerGram });
        } else {
            res.status(401).json({ success: false, message: 'Invalid password' });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/settings', async (req, res) => {
    try {
        let settings = await Settings.findOne({ id: 'global' });
        if (!settings) settings = await (new Settings({})).save();
        res.json({ ratePerGram: settings.ratePerGram });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const { currentPassword, newPassword, ratePerGram } = req.body;
        let settings = await Settings.findOne({ id: 'global' });
        if (!settings) settings = await (new Settings({})).save();
        
        if (newPassword) {
            if (settings.password !== currentPassword) {
                return res.status(401).json({ message: 'Incorrect current password' });
            }
            settings.password = newPassword;
        }
        
        if (ratePerGram !== undefined) {
            settings.ratePerGram = ratePerGram;
        }
        
        await settings.save();
        res.json({ success: true, ratePerGram: settings.ratePerGram });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/loans', async (req, res) => {
    try {
        const loans = await Loan.find().sort({ date: -1 });
        res.json(loans);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/loans', async (req, res) => {
    try {
        const { name, phone, weight, stoneWastage, purity, ornamentType, amount, interest, date, goldPhoto, customerPhoto } = req.body;
        
        // Auto-gen ID logic
        const lastLoan = await Loan.findOne().sort({ date: -1 });
        const lastIdNum = lastLoan && lastLoan.id ? parseInt(lastLoan.id.split('-')[1]) : 1000;
        const nextId = `L-${lastIdNum + 1}`;

        const loanDate = date ? new Date(date) : new Date();
        const dueDate = new Date(loanDate);
        dueDate.setFullYear(dueDate.getFullYear() + 1);

        const newLoan = new Loan({
            id: nextId,
            name, phone, weight, stoneWastage: stoneWastage || 0, purity, ornamentType: ornamentType || 'Necklace', amount, interest,
            date: loanDate,
            dueDate: dueDate,
            goldPhoto: goldPhoto || null,
            customerPhoto: customerPhoto || null
        });

        const savedLoan = await newLoan.save();
        res.status(201).json(savedLoan);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

app.put('/api/loans/:id/release', async (req, res) => {
    try {
        const loan = await Loan.findOne({ id: req.params.id });
        if (!loan) return res.status(404).json({ message: 'Loan not found' });
        if (loan.status === 'Closed') return res.status(400).json({ message: 'Loan already closed' });

        const releasedDate = new Date();
        const state = getLoanState(loan, releasedDate);
        
        loan.status = 'Closed';
        loan.releasedDate = releasedDate;
        loan.finalInterest = state.interestDue; 
        loan.totalPaid = (loan.totalPaid || 0) + state.outstanding; 
        loan.amount = state.currentPrincipal; // Remaining principal at closing should be 0 ideally but store if needed

        const updatedLoan = await loan.save();
        res.json(updatedLoan);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/loans/:id/payments', async (req, res) => {
    try {
        const { amount, description } = req.body;
        const loan = await Loan.findOne({ id: req.params.id });
        if (!loan) return res.status(404).json({ message: 'Loan not found' });

        const paymentId = `PAY-${Date.now().toString().slice(-6)}`;
        const newPayment = {
            paymentId,
            amount: parseFloat(amount),
            description: description || 'Interest Payment',
            date: new Date()
        };

        loan.payments.push(newPayment);
        const savedLoan = await loan.save();
        res.status(201).json({ loan: savedLoan, payment: newPayment });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const loans = await Loan.find();
        const activeLoans = loans.filter(l => l.status === 'Active');
        const closedLoans = loans.filter(l => l.status === 'Closed');

        const totalGoldReceived = loans.reduce((sum, l) => sum + (l.weight || 0), 0);
        const goldInStore = activeLoans.reduce((sum, l) => sum + (l.weight || 0), 0);
        const goldReleased = closedLoans.reduce((sum, l) => sum + (l.weight || 0), 0);
        const totalActiveLoanAmount = activeLoans.reduce((sum, l) => sum + (l.amount || 0), 0);
        
        // New: Track actual money collected
        let totalInterestCollected = 0;
        loans.forEach(l => {
            if (l.payments) {
                l.payments.forEach(p => totalInterestCollected += (p.amount || 0));
            }
        });
        const totalRevenue = closedLoans.reduce((sum, l) => sum + (l.finalInterest || 0), 0) + totalInterestCollected;

        res.json({
            totalLoans: loans.length,
            activeLoansCount: activeLoans.length,
            closedLoansCount: closedLoans.length,
            totalGoldReceived: totalGoldReceived.toFixed(2),
            goldInStore: goldInStore.toFixed(2),
            goldReleased: goldReleased.toFixed(2),
            totalActiveLoanAmount: totalActiveLoanAmount.toFixed(2),
            totalInterestCollected: totalInterestCollected.toFixed(2),
            totalRevenue: totalRevenue.toFixed(2)
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Fallback to React app
app.get('/*splat', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
