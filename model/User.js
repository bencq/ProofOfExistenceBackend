const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        require: true
    },
    password: {
        type: String,
        required: true
    },
}, {versionKey: false});

const User = mongoose.model('User', UserSchema);

module.exports = User;