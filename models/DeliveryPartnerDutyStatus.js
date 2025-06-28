const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  dutyTrue: Date,
  dutyFalse: Date,
  workingHours: Number
});

const dailyLogSchema = new mongoose.Schema({
  date: String, // "YYYY-MM-DD"
  sessions: [sessionSchema]
});

const deliveryPartnerDutyStatusSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  statusLog: [dailyLogSchema]
});

module.exports = mongoose.model('DeliveryPartnerDutyStatus', deliveryPartnerDutyStatusSchema);
