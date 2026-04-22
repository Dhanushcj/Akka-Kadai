const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });

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
        description: String
    }]
});

const Loan = mongoose.model('Loan', loanSchema);

async function wipeDatabase() {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            console.error('MONGODB_URI not found in environment');
            process.exit(1);
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(uri);
        console.log('Connected.');

        console.log('Deleting all loans...');
        const result = await Loan.deleteMany({});
        console.log(`Successfully deleted ${result.deletedCount} loans.`);

        await mongoose.disconnect();
        console.log('Disconnected.');
        process.exit(0);
    } catch (err) {
        console.error('Error wiping database:', err);
        process.exit(1);
    }
}

wipeDatabase();
