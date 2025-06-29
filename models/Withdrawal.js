const mongoose = require("mongoose")

const withdrawalSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
  },
  status: {
    type: String,
    enum: ["PENDING", "APPROVED", "REJECTED", "COMPLETED"],
    default: "PENDING",
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  processedAt: {
    type: Date,
  },
  bankDetails: {
    accountNumber: String,
    ifscCode: String,
    accountHolderName: String,
  },
  adminNotes: {
    type: String,
  },
})

module.exports = mongoose.model("Withdrawal", withdrawalSchema)
