const mongoose = require("mongoose")

const deliveryPartnerStatsSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  date: {
    type: String, // YYYY-MM-DD format
    required: true,
  },
  workingHours: {
    type: Number,
    default: null, // null if not on duty that day
  },
  completedOrders: {
    type: Number,
    default: 0,
  },
  rejectedOrders: {
    type: Number,
    default: 0,
  },
  earnings: {
    type: Number,
    default: 0, // completedOrders * 30
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

// Create compound index for email and date
deliveryPartnerStatsSchema.index({ email: 1, date: 1 }, { unique: true })

// Update earnings before saving
deliveryPartnerStatsSchema.pre("save", function (next) {
  this.earnings = this.completedOrders * 30
  this.updatedAt = new Date()
  next()
})

module.exports = mongoose.model("DeliveryPartnerStats", deliveryPartnerStatsSchema)
