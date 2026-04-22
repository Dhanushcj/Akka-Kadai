const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const mongoUri = process.env.MONGODB_URI;

async function resetAdmin() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to DB');
        
        const settingsSchema = new mongoose.Schema({
            id: String,
            password: String
        });
        const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
        
        // Delete any existing global settings
        await Settings.deleteMany({ id: 'global' });
        console.log('Cleared existing settings');
        
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const newSettings = new Settings({
            id: 'global',
            password: hashedPassword
        });
        
        await newSettings.save();
        console.log('New admin account created with password: admin123');
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

resetAdmin();
