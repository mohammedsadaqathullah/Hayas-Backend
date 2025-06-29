const express = require("express")
const router = express.Router()
const Withdrawal = require("../models/Withdrawal")
const DeliveryPartnerStats = require("../models/DeliveryPartnerStats")
const Order = require("../models/Order")

// POST /withdrawal/request
router.post("/request", async (req, res) => {
  try {
    const { email, amount, orderIds } = req.body

    if (!email || !amount || amount <= 0) {
      return res.status(400).json({ error: "Valid email and amount are required" })
    }

    // Get order details if provided
    let orderDetails = []
    if (orderIds && orderIds.length > 0) {
      const orders = await Order.find({ _id: { $in: orderIds } })
      orderDetails = orders.map((order) => ({
        orderId: order._id,
        orderDate: order.createdAt,
        earnings: 30, // Fixed earning per order
      }))
    }

    const withdrawal = new Withdrawal({
      email,
      amount,
      orderDetails,
      status: "Pending",
    })

    await withdrawal.save()

    res.status(201).json({
      message: "Withdrawal request submitted successfully",
      withdrawal,
    })
  } catch (error) {
    console.error("Error creating withdrawal request:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /withdrawal/:email
router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params
    const withdrawals = await Withdrawal.find({ email }).populate("orderDetails.orderId").sort({ requestedAt: -1 })

    res.status(200).json(withdrawals)
  } catch (error) {
    console.error("Error fetching withdrawals:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /withdrawal/admin/all
router.get("/admin/all", async (req, res) => {
  try {
    const { status } = req.query
    const filter = status ? { status } : {}

    const withdrawals = await Withdrawal.find(filter).populate("orderDetails.orderId").sort({ requestedAt: -1 })

    res.status(200).json(withdrawals)
  } catch (error) {
    console.error("Error fetching all withdrawals:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// PATCH /withdrawal/:id/status
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params
    const { status, processedBy, remarks } = req.body

    if (!status || !["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ error: "Valid status (Approved/Rejected) is required" })
    }

    const withdrawal = await Withdrawal.findByIdAndUpdate(
      id,
      {
        status,
        processedAt: new Date(),
        processedBy: processedBy || "Admin",
        remarks: remarks || null,
      },
      { new: true },
    )

    if (!withdrawal) {
      return res.status(404).json({ error: "Withdrawal request not found" })
    }

    res.status(200).json({
      message: `Withdrawal request ${status.toLowerCase()} successfully`,
      withdrawal,
    })
  } catch (error) {
    console.error("Error updating withdrawal status:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /withdrawal/:email/available-earnings
router.get("/:email/available-earnings", async (req, res) => {
  try {
    const { email } = req.params

    // Get total earnings from stats
    const stats = await DeliveryPartnerStats.find({ email })
    const totalEarnings = stats.reduce((sum, stat) => sum + stat.earnings, 0)

    // Get total withdrawn amount (approved withdrawals)
    const withdrawals = await Withdrawal.find({
      email,
      status: "Approved",
    })
    const totalWithdrawn = withdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0)

    // Get pending withdrawal amount
    const pendingWithdrawals = await Withdrawal.find({
      email,
      status: "Pending",
    })
    const pendingAmount = pendingWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0)

    const availableEarnings = totalEarnings - totalWithdrawn - pendingAmount

    res.status(200).json({
      totalEarnings,
      totalWithdrawn,
      pendingAmount,
      availableEarnings: Math.max(0, availableEarnings),
    })
  } catch (error) {
    console.error("Error calculating available earnings:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

module.exports = router
