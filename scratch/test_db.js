const mongoose = require('mongoose');

const uri = "mongodb+srv://dhanushchakravarthy18_db_user:Dhanushcj%40123@antigraviity.tnsqugs.mongodb.net/?appName=Antigraviity";

console.log("Attempting to connect to MongoDB Atlas...");

mongoose.connect(uri)
  .then(() => {
    console.log("SUCCESS: Connected to MongoDB Atlas!");
    process.exit(0);
  })
  .catch(err => {
    console.error("FAILURE: Connection failed.");
    console.error(err);
    process.exit(1);
  });
