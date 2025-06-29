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
  orderDetails: [
    {
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
      orderDate: Date,
      earnings: Number,
    },
  ],
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending",
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  processedAt: {
    type: Date,
    default: null,
  },
  processedBy: {
    type: String,
    default: null,
  },
  remarks: {
    type: String,
    default: null,
  },
})

module.exports = mongoose.model("Withdrawal", withdrawalSchema)
