const express = require("express")
const router = express.Router()
const Stats = require("../models/Stats")
const Order = require("../models/Order")
const DeliveryPartnerDutyStatus = require("../models/DeliveryPartnerDutyStatus")

// Helper function to calculate earnings per order
const EARNINGS_PER_ORDER = 30

// Helper function to get current effective status
function getCurrentStatus(order) {
  if (!order.statusHistory || order.statusHistory.length === 0) {
    return order.status
  }

  // Check if there's a DELIVERED status
  const deliveredEntry = order.statusHistory
    .filter((entry) => entry.status === "DELIVERED")
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0]

  if (deliveredEntry) return "DELIVERED"

  // Check if there's a CONFIRMED status
  const confirmedEntry = order.statusHistory
    .filter((entry) => entry.status === "CONFIRMED")
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0]

  if (confirmedEntry) return "CONFIRMED"

  // Otherwise return the main status
  return order.status
}

// Helper function to check if user has confirmed this order
function hasUserConfirmed(order, userEmail) {
  return order.statusHistory.some((entry) => entry.email === userEmail && entry.status === "CONFIRMED")
}

// Helper function to check if user has delivered this order
function hasUserDelivered(order, userEmail) {
  return order.statusHistory.some((entry) => entry.email === userEmail && entry.status === "DELIVERED")
}

// GET /stats/:email - Get stats for a delivery partner
router.get("/:email", async (req, res) => {
  try {
    const email = req.params.email

    // Get or create stats document
    let stats = await Stats.findOne({ email })
    if (!stats) {
      stats = new Stats({ email })
    }

    // Calculate real-time stats from orders
    const allOrders = await Order.find({
      statusHistory: {
        $elemMatch: { email },
      },
    })

    // Filter orders where this partner was involved
    const partnerOrders = allOrders.filter((order) => {
      return hasUserConfirmed(order, email) || hasUserDelivered(order, email)
    })

    // Calculate stats
    const totalOrders = partnerOrders.length
    const completedOrders = partnerOrders.filter((order) => hasUserDelivered(order, email)).length
    const cancelledOrders = partnerOrders.filter(
      (order) => hasUserConfirmed(order, email) && getCurrentStatus(order) === "CANCELLED",
    ).length

    const totalEarnings = completedOrders * EARNINGS_PER_ORDER
    const availableBalance = totalEarnings - stats.withdrawnAmount

    // Calculate today's stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayOrders = partnerOrders.filter((order) => {
      const orderDate = new Date(order.createdAt)
      return orderDate >= today && orderDate < tomorrow && hasUserDelivered(order, email)
    })

    const todayEarnings = todayOrders.length * EARNINGS_PER_ORDER

    // Calculate this week's stats
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay())

    const weekOrders = partnerOrders.filter((order) => {
      const orderDate = new Date(order.createdAt)
      return orderDate >= weekStart && hasUserDelivered(order, email)
    })

    const weekEarnings = weekOrders.length * EARNINGS_PER_ORDER

    // Calculate this month's stats
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    const monthOrders = partnerOrders.filter((order) => {
      const orderDate = new Date(order.createdAt)
      return orderDate >= monthStart && hasUserDelivered(order, email)
    })

    const monthEarnings = monthOrders.length * EARNINGS_PER_ORDER

    // Update stats document
    stats.totalOrders = totalOrders
    stats.completedOrders = completedOrders
    stats.cancelledOrders = cancelledOrders
    stats.totalEarnings = totalEarnings
    stats.availableBalance = availableBalance
    stats.lastUpdated = new Date()

    await stats.save()

    // Get working hours from duty status
    const dutyStatus = await DeliveryPartnerDutyStatus.findOne({ email })
    let totalWorkingHours = 0

    if (dutyStatus && dutyStatus.statusLog) {
      totalWorkingHours = dutyStatus.statusLog.reduce((total, log) => {
        return (
          total +
          log.sessions.reduce((sessionTotal, session) => {
            return sessionTotal + (session.workingHours || 0)
          }, 0)
        )
      }, 0)
    }

    res.status(200).json({
      ...stats.toObject(),
      todayEarnings,
      weekEarnings,
      monthEarnings,
      todayOrders: todayOrders.length,
      weekOrders: weekOrders.length,
      monthOrders: monthOrders.length,
      totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
      earningsPerOrder: EARNINGS_PER_ORDER,
    })
  } catch (error) {
    console.error("Error fetching stats:", error)
    res.status(500).json({ error: "Failed to fetch stats" })
  }
})

// POST /stats/update-rating - Update delivery partner rating
router.post("/update-rating", async (req, res) => {
  try {
    const { email, rating } = req.body

    if (!email || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Valid email and rating (1-5) are required" })
    }

    let stats = await Stats.findOne({ email })
    if (!stats) {
      stats = new Stats({ email })
    }

    // Calculate new average rating
    const totalRating = stats.rating * stats.ratingCount + rating
    stats.ratingCount += 1
    stats.rating = totalRating / stats.ratingCount
    stats.lastUpdated = new Date()

    await stats.save()

    res.status(200).json({ message: "Rating updated successfully", stats })
  } catch (error) {
    console.error("Error updating rating:", error)
    res.status(500).json({ error: "Failed to update rating" })
  }
})

module.exports = router
