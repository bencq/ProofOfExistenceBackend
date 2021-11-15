const mongoose = require('mongoose');

const EvidenceIDDocSchema = new mongoose.Schema({
    evidenceID:
    {
        type: Number,
        required: true
    }
}, {versionKey: false});

const EvidenceIDDoc = mongoose.model('EvidenceIDDoc', EvidenceIDDocSchema);

module.exports = EvidenceIDDoc;