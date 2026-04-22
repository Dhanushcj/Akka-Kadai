const mongoose = require('mongoose');
require('dotenv').config();

const mongoUri = process.env.MONGODB_URI;

async function checkSettings() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to DB');
        
        const settingsSchema = new mongoose.Schema({
            id: String,
            password: String
        });
        const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
        
        const settings = await Settings.findOne({ id: 'global' });
        if (settings) {
            console.log('Found settings document');
            console.log('ID:', settings.id);
            console.log('Password exists:', !!settings.password);
            console.log('Password length:', settings.password ? settings.password.length : 0);
            
            // If length is small (e.g. 8 for 'admin123'), it's definitely plaintext
            if (settings.password && settings.password.length < 30) {
                console.log('Password appears to be PLAINTEXT. Needs hashing.');
            } else {
                console.log('Password looks like a hash.');
            }
        } else {
            console.log('No settings document found.');
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkSettings();
