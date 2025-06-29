const express = require("express")
const router = express.Router()
const DeliveryPartnerUser = require("../models/DeliveryPartnerUser")
const DeliveryPartnersImages = require("../models/DeliveryPartnersImages")
const DeliveryPartnerDutyStatus = require("../models/DeliveryPartnerDutyStatus")
const DeliveryPartnerStats = require("../models/DeliveryPartnerStats")
const Withdrawal = require("../models/Withdrawal")
const Order = require("../models/Order")
const { sendEmailOTP, verifyOTP } = require("../models/Otp")

// POST - Register or Update Delivery Partner
router.post("/", async (req, res) => {
  try {
    const {
      name,
      parentName,
      email,
      phone,
      address,
      pincode,
      profileImage,
      dlFront,
      dlBack,
      aadhaarFront,
      aadhaarBack,
    } = req.body

    // 🔍 Check for required fields
    if (!name || !email || !phone || !address || !pincode) {
      return res.status(400).json({ error: "All required fields must be provided." })
    }

    // ✅ Check if images exist for this email before proceeding
    const imageDoc = await DeliveryPartnersImages.findOne({ email })
    if (!imageDoc) {
      return res.status(400).json({
        error: "Please upload your documents before registering.",
      })
    }

    // 🧾 Map of user field names to image keys
    const imageFieldMap = {
      profileImage: "profile",
      dlFront: "driving_license_front",
      dlBack: "driving_license_back",
      aadhaarFront: "aadhaar_front",
      aadhaarBack: "aadhaar_back",
    }

    // 🔍 Find missing images
    const missingTypes = Object.entries(imageFieldMap)
      .filter(([_, imageKey]) => !imageDoc.images?.[imageKey]?.url)
      .map(([userField, _]) => userField)

    if (missingTypes.length > 0) {
      return res.status(400).json({
        error: `Missing document(s): ${missingTypes.join(", ")}. Please upload all required documents before registering.`,
      })
    }

    // 🧠 Check if user already exists
    const existingUser = await DeliveryPartnerUser.findOne({ email })

    // 📥 Register or update the user
    const updatedUser = await DeliveryPartnerUser.findOneAndUpdate(
      { email },
      {
        $set: {
          name,
          parentName,
          phone,
          address,
          pincode,
          profileImage,
          dlFront,
          dlBack,
          aadhaarFront,
          aadhaarBack,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )

    const message = existingUser ? "User updated successfully" : "User registered successfully"

    res.status(201).json({ message, user: updatedUser })
  } catch (err) {
    console.error("Register error:", err)
    res.status(500).json({ error: "Internal server error", details: err.message })
  }
})

// POST /delivery-partners/send-otp
router.post("/send-otp", async (req, res) => {
  const { email } = req.body
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email is required" })
  }

  try {
    await sendEmailOTP(email)
    res.status(200).json({ message: "OTP sent to email" })
  } catch (err) {
    console.error("Send OTP error:", err)
    res.status(500).json({ error: "Failed to send OTP" })
  }
})

// POST /api/delivery-partners/verify-otp
router.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body
  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP are required" })
  }

  const valid = verifyOTP(email, otp)
  if (!valid) {
    return res.status(400).json({ error: "Invalid or expired OTP" })
  }

  res.status(200).json({ message: "OTP verified successfully" })
})

// GET - Fetch all registered delivery partners
router.get("/", async (req, res) => {
  try {
    const users = await DeliveryPartnerUser.find().sort({ createdAt: -1 })
    res.status(200).json(users)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to fetch users" })
  }
})

// PATCH /delivery-partner/status
router.patch("/status", async (req, res) => {
  const { email, status } = req.body
  if (!email || (status !== "Approved" && status !== "Rejected")) {
    return res.status(400).json({
      error: 'Invalid request: provide email and status as "Approved" or "Rejected"',
    })
  }

  try {
    const user = await DeliveryPartnerUser.findOneAndUpdate({ email }, { $set: { status } }, { new: true })

    if (!user) {
      return res.status(404).json({ error: "Delivery partner not found" })
    }

    res.status(200).json({ message: `Status updated to ${status}`, user })
  } catch (err) {
    console.error("Status update error:", err)
    res.status(500).json({ error: "Failed to update status" })
  }
})

// Helper function to calculate period summaries
function calculatePeriodSummary(stats, period) {
  const now = new Date()
  let startDate

  switch (period) {
    case "week":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    default:
      return null
  }

  const startDateStr = startDate.toISOString().split("T")[0]
  const endDateStr = now.toISOString().split("T")[0]

  const periodStats = stats.filter((stat) => stat.date >= startDateStr && stat.date <= endDateStr)

  return periodStats.reduce(
    (acc, stat) => {
      acc.totalWorkingHours += stat.workingHours || 0
      acc.totalCompletedOrders += stat.completedOrders
      acc.totalRejectedOrders += stat.rejectedOrders
      acc.totalEarnings += stat.earnings
      acc.daysWorked += stat.workingHours > 0 ? 1 : 0
      return acc
    },
    {
      totalWorkingHours: 0,
      totalCompletedOrders: 0,
      totalRejectedOrders: 0,
      totalEarnings: 0,
      daysWorked: 0,
      period,
      startDate: startDateStr,
      endDate: endDateStr,
    },
  )
}

// POST - Fetch delivery partner details, duty status, assigned orders, stats, and withdrawals
router.post("/by-email", async (req, res) => {
  const { email } = req.body
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email is required" })
  }

  try {
    // Fetch user details
    const user = await DeliveryPartnerUser.findOne({ email })
    if (!user) {
      return res.status(404).json({ error: "Delivery partner not found" })
    }

    // Fetch duty status
    const dutyStatus = await DeliveryPartnerDutyStatus.findOne({ email })

    // Fetch order history
    const orders = await Order.find({
      statusHistory: {
        $elemMatch: { email },
      },
    }).sort({ createdAt: -1 })

    // Fetch delivery partner stats
    const stats = await DeliveryPartnerStats.find({ email }).sort({ date: -1 })

    // Calculate weekly and monthly summaries
    const weeklySummary = calculatePeriodSummary(stats, "week")
    const monthlySummary = calculatePeriodSummary(stats, "month")

    // Fetch withdrawal history
    const withdrawals = await Withdrawal.find({ email }).populate("orderDetails.orderId").sort({ requestedAt: -1 })

    // Calculate available earnings
    const totalEarnings = stats.reduce((sum, stat) => sum + stat.earnings, 0)
    const totalWithdrawn = withdrawals
      .filter((w) => w.status === "Approved")
      .reduce((sum, withdrawal) => sum + withdrawal.amount, 0)
    const pendingAmount = withdrawals
      .filter((w) => w.status === "Pending")
      .reduce((sum, withdrawal) => sum + withdrawal.amount, 0)
    const availableEarnings = Math.max(0, totalEarnings - totalWithdrawn - pendingAmount)

    res.status(200).json({
      userDetails: user,
      dutyStatus: dutyStatus || { message: "No duty status found for this user." },
      orderHistory: orders.length ? orders : "No orders assigned to this partner.",
      stats: {
        dailyStats: stats,
        weeklySummary,
        monthlySummary,
        totalStats: {
          totalWorkingHours: stats.reduce((sum, stat) => sum + (stat.workingHours || 0), 0),
          totalCompletedOrders: stats.reduce((sum, stat) => sum + stat.completedOrders, 0),
          totalRejectedOrders: stats.reduce((sum, stat) => sum + stat.rejectedOrders, 0),
          totalEarnings,
        },
      },
      withdrawals: {
        history: withdrawals,
        summary: {
          totalEarnings,
          totalWithdrawn,
          pendingAmount,
          availableEarnings,
        },
      },
    })
  } catch (err) {
    console.error("Fetch by email error:", err)
    res.status(500).json({ error: "Failed to fetch user by email" })
  }
})

module.exports = router
