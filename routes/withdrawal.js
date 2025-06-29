const express = require("express")
const router = express.Router()
const Withdrawal = require("../models/Withdrawal")
const Stats = require("../models/Stats")

// POST /withdrawal/request - Request withdrawal
router.post("/request", async (req, res) => {
  try {
    const { email, amount, bankDetails } = req.body

    if (!email || !amount || amount <= 0) {
      return res.status(400).json({ error: "Valid email and amount are required" })
    }

    if (!bankDetails || !bankDetails.accountNumber || !bankDetails.ifscCode || !bankDetails.accountHolderName) {
      return res.status(400).json({ error: "Complete bank details are required" })
    }

    // Get current stats to check available balance
    const stats = await Stats.findOne({ email })
    if (!stats) {
      return res.status(404).json({ error: "Partner stats not found" })
    }

    // Calculate current available balance
    const availableBalance = stats.totalEarnings - stats.withdrawnAmount

    if (amount > availableBalance) {
      return res.status(400).json({
        error: `Insufficient balance. Available: ₹${availableBalance}, Requested: ₹${amount}`,
      })
    }

    // Check for pending withdrawals
    const pendingWithdrawal = await Withdrawal.findOne({
      email,
      status: "PENDING",
    })

    if (pendingWithdrawal) {
      return res.status(400).json({
        error: "You already have a pending withdrawal request",
      })
    }

    // Create withdrawal request
    const withdrawal = new Withdrawal({
      email,
      amount,
      bankDetails,
      status: "PENDING",
    })

    await withdrawal.save()

    res.status(201).json({
      message: "Withdrawal request submitted successfully",
      withdrawal: {
        id: withdrawal._id,
        amount: withdrawal.amount,
        status: withdrawal.status,
        requestedAt: withdrawal.requestedAt,
      },
    })
  } catch (error) {
    console.error("Error creating withdrawal request:", error)
    res.status(500).json({ error: "Failed to create withdrawal request" })
  }
})

// GET /withdrawal/:email - Get withdrawal history for a partner
router.get("/:email", async (req, res) => {
  try {
    const email = req.params.email

    const withdrawals = await Withdrawal.find({ email }).sort({ requestedAt: -1 }).select("-bankDetails") // Don't send sensitive bank details

    res.status(200).json(withdrawals)
  } catch (error) {
    console.error("Error fetching withdrawals:", error)
    res.status(500).json({ error: "Failed to fetch withdrawal history" })
  }
})

// GET /withdrawal/admin/all - Get all withdrawal requests (admin only)
router.get("/admin/all", async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find().sort({ requestedAt: -1 })

    res.status(200).json(withdrawals)
  } catch (error) {
    console.error("Error fetching all withdrawals:", error)
    res.status(500).json({ error: "Failed to fetch withdrawals" })
  }
})

// PATCH /withdrawal/:id/status - Update withdrawal status (admin only)
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params
    const { status, adminNotes } = req.body

    if (!["APPROVED", "REJECTED", "COMPLETED"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" })
    }

    const withdrawal = await Withdrawal.findById(id)
    if (!withdrawal) {
      return res.status(404).json({ error: "Withdrawal request not found" })
    }

    if (withdrawal.status !== "PENDING" && status === "APPROVED") {
      return res.status(400).json({ error: "Can only approve pending requests" })
    }

    withdrawal.status = status
    withdrawal.processedAt = new Date()
    if (adminNotes) {
      withdrawal.adminNotes = adminNotes
    }

    await withdrawal.save()

    // If completed, update stats
    if (status === "COMPLETED") {
      const stats = await Stats.findOne({ email: withdrawal.email })
      if (stats) {
        stats.withdrawnAmount += withdrawal.amount
        await stats.save()
      }
    }

    res.status(200).json({
      message: `Withdrawal ${status.toLowerCase()} successfully`,
      withdrawal,
    })
  } catch (error) {
    console.error("Error updating withdrawal status:", error)
    res.status(500).json({ error: "Failed to update withdrawal status" })
  }
})

module.exports = router
