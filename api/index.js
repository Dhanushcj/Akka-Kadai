const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Security Headers
app.use(helmet());

// Brute-force protection for Login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login requests per window
    message: { message: 'Too many login attempts, please try again after 15 minutes' }
});

const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? [/\.vercel\.app$/, 'http://localhost:5173'] // Allow Vercel domains and local dev
        : true, // Allow all in dev
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// MongoDB Connection with robust error handling for Serverless
// Helper: Serverless robust connection
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) {
        console.log('Using existing MongoDB connection');
        return;
    }
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/gold-shop';
        
        if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
            console.warn('Warning: Neither MONGODB_URI nor MONGO_URI found in environment. Using local fallback.');
        }

        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 5000
        });
        console.log(`Connected to MongoDB: ${mongoUri.includes('cluster') ? 'Atlas' : 'Local'}`);
    } catch (err) {
        console.error('MongoDB connection error:', err);
        throw new Error('Database connection failed: ' + err.message);
    }
};

// Loan Schema
const loanSchema = new mongoose.Schema({
    id: { type: String, unique: true },
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

const Loan = mongoose.models.Loan || mongoose.model('Loan', loanSchema);

// Settings Schema
const settingsSchema = new mongoose.Schema({
    id: { type: String, default: 'global' },
    password: { type: String, required: true } // Hashed password
});
const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);

// Middleware: Verify JWT Token
const JWT_SECRET = process.env.JWT_SECRET || 'svm-gold-secret-key-2026';

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(403).json({ message: 'Invalid or expired token.' });
    }
};

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

// --- API Routes ---

app.post('/api/login', loginLimiter, async (req, res) => {
    console.log('Login attempt received');
    try {
        await connectDB();
        let settings = await Settings.findOne({ id: 'global' });
        
        // Handle initial setup (first time run)
        if (!settings) {
            console.log('No settings found, creating default admin account...');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            settings = await (new Settings({ id: 'global', password: hashedPassword })).save();
        }
        
        const isMatch = await bcrypt.compare(req.body.password, settings.password);
        
        if (isMatch) {
            if (process.env.NODE_ENV !== 'production') console.log('Login successful');
            
            // Generate JWT Token (Expires in 24h)
            const token = jwt.sign(
                { id: 'admin' }, 
                JWT_SECRET, 
                { expiresIn: '24h' }
            );
            
            res.json({ success: true, token });
        } else {
            console.warn('Login failed: Invalid password attempt');
            res.status(401).json({ success: false, message: 'Invalid password' });
        }
    } catch (err) {
        console.error('Login route error:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.get('/api/settings', verifyToken, async (req, res) => {
    try {
        await connectDB();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/settings', verifyToken, async (req, res) => {
    try {
        await connectDB();
        const { currentPassword, newPassword } = req.body;
        let settings = await Settings.findOne({ id: 'global' });
        
        if (newPassword) {
            const isMatch = await bcrypt.compare(currentPassword, settings.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Incorrect current password' });
            }
            settings.password = await bcrypt.hash(newPassword, 10);
        }

        await settings.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Important diagnostic route
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online', 
        time: new Date().toISOString(),
        dbConnected: mongoose.connection.readyState === 1,
        engine: 'Vercel Serverless'
    });
});

app.get('/api/loans', verifyToken, async (req, res) => {
    try {
        await connectDB();
        const loans = await Loan.find().sort({ date: -1 });
        res.json(loans);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/loans', verifyToken, async (req, res) => {
    try {
        await connectDB();
        const { name, phone, weight, stoneWastage, purity, ornamentType, amount, interest, date, goldPhoto, customerPhoto } = req.body;
        
        const loans = await Loan.find({ id: { $regex: /^L-/ } });
        let lastIdNum = 1000;
        if (loans.length > 0) {
            loans.forEach(loan => {
                const parts = loan.id.split('-');
                const num = parseInt(parts[1]);
                if (!isNaN(num) && num > lastIdNum) lastIdNum = num;
            });
        }
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
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/loans/:id/release', verifyToken, async (req, res) => {
    try {
        await connectDB();
        const loan = await Loan.findOne({ id: req.params.id });
        if (!loan) return res.status(404).json({ message: 'Loan not found' });
        if (loan.status === 'Closed') return res.status(400).json({ message: 'Loan already closed' });

        const releasedDate = new Date();
        const state = getLoanState(loan, releasedDate);
        
        loan.status = 'Closed';
        loan.releasedDate = releasedDate;
        loan.finalInterest = state.interestDue; 
        loan.totalPaid = (loan.totalPaid || 0) + state.outstanding; 
        loan.amount = state.currentPrincipal;

        const updatedLoan = await loan.save();
        res.json(updatedLoan);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/loans/:id/payments', verifyToken, async (req, res) => {
    try {
        await connectDB();
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
        res.status(400).json({ error: err.message });
    }
});

app.get('/api/stats', verifyToken, async (req, res) => {
    try {
        await connectDB();
        const loans = await Loan.find();
        const activeLoans = loans.filter(l => l.status === 'Active');
        const closedLoans = loans.filter(l => l.status === 'Closed');

        const totalGoldReceived = loans.reduce((sum, l) => sum + (l.weight || 0), 0);
        const goldInStore = activeLoans.reduce((sum, l) => sum + (l.weight || 0), 0);
        const goldReleased = closedLoans.reduce((sum, l) => sum + (l.weight || 0), 0);
        const totalActiveLoanAmount = activeLoans.reduce((sum, l) => sum + (l.amount || 0), 0);

        // Track actual money collected
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
        res.status(500).json({ error: err.message });
    }
});

module.exports = app;
