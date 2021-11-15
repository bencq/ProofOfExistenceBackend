const mongoose = require('mongoose');

const EvidenceSchema = new mongoose.Schema({
    evidenceAddress:
    {
        type: String,
        required: true
    },
    evidenceData: {
        type: String,
        require: true
    },
    username: {
        type: String,
        required: true
    },
    transactionHash:
    {
        type: String,
        required: true
    },
    //items for convenience of search
    evidenceName:
    {
        type: String,
        required: false
    },
    evidenceType:
    {
        type: String,
        required: true
    },
    file:
    {
        type: Object,
        required: false
    },
    //redundant items
    blockNumber:
    {
        type: Number,
        required: false
    },
    timestamp:
    {
        type: Number,
        required: false
    },
    //redundant items in evidenceAddress
    evidenceID:
    {
        type: Number,
        required: true
    },
    evidenceHash:
    {
        type: String,
        required: true
    }
}, {versionKey: false});

const Evidence = mongoose.model('Evidence', EvidenceSchema);

module.exports = Evidence;