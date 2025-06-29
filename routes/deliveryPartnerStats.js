const express = require("express")
const router = express.Router()
const DeliveryPartnerStats = require("../models/DeliveryPartnerStats")
const DeliveryPartnerDutyStatus = require("../models/DeliveryPartnerDutyStatus")
const Order = require("../models/Order")

function formatDate(date) {
  return date.toISOString().split("T")[0] // YYYY-MM-DD
}

// Helper function to get or create stats for a date
async function getOrCreateStats(email, date) {
  let stats = await DeliveryPartnerStats.findOne({ email, date })

  if (!stats) {
    stats = new DeliveryPartnerStats({
      email,
      date,
      workingHours: null,
      completedOrders: 0,
      rejectedOrders: 0,
      earnings: 0,
    })
    await stats.save()
  }

  return stats
}

// Helper function to update working hours from duty status
async function updateWorkingHours(email, date) {
  const dutyRecord = await DeliveryPartnerDutyStatus.findOne({ email })

  if (!dutyRecord) return null

  const dateLog = dutyRecord.statusLog.find((log) => log.date === date)

  if (!dateLog || !dateLog.sessions.length) return null

  // Calculate total working hours for the date
  const totalHours = dateLog.sessions.reduce((total, session) => {
    return total + (session.workingHours || 0)
  }, 0)

  return totalHours > 0 ? totalHours : null
}

// POST /delivery-partner-stats/update-order-stats
router.post("/update-order-stats", async (req, res) => {
  try {
    const { email, orderId, action, orderDate } = req.body

    if (!email || !orderId || !action || !orderDate) {
      return res.status(400).json({ error: "Email, orderId, action, and orderDate are required" })
    }

    const date = formatDate(new Date(orderDate))
    const stats = await getOrCreateStats(email, date)

    // Update working hours
    const workingHours = await updateWorkingHours(email, date)
    if (workingHours !== null) {
      stats.workingHours = workingHours
    }

    // Update order counts based on action
    if (action === "COMPLETED" || action === "DELIVERED") {
      stats.completedOrders += 1
    } else if (action === "REJECTED" || action === "CANCELLED") {
      stats.rejectedOrders += 1
    }

    await stats.save()

    res.status(200).json({ message: "Stats updated successfully", stats })
  } catch (error) {
    console.error("Error updating order stats:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /delivery-partner-stats/:email
router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params
    const stats = await DeliveryPartnerStats.find({ email }).sort({ date: -1 })

    res.status(200).json(stats)
  } catch (error) {
    console.error("Error fetching stats:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// GET /delivery-partner-stats/:email/summary
router.get("/:email/summary", async (req, res) => {
  try {
    const { email } = req.params
    const { period = "week" } = req.query // week, month, year

    const now = new Date()
    let startDate

    switch (period) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    const startDateStr = formatDate(startDate)
    const endDateStr = formatDate(now)

    const stats = await DeliveryPartnerStats.find({
      email,
      date: { $gte: startDateStr, $lte: endDateStr },
    }).sort({ date: -1 })

    // Calculate summary
    const summary = stats.reduce(
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

    res.status(200).json({
      summary,
      dailyStats: stats,
    })
  } catch (error) {
    console.error("Error fetching summary:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// POST /delivery-partner-stats/sync-working-hours
router.post("/sync-working-hours", async (req, res) => {
  try {
    const { email, date } = req.body

    if (!email || !date) {
      return res.status(400).json({ error: "Email and date are required" })
    }

    const stats = await getOrCreateStats(email, date)
    const workingHours = await updateWorkingHours(email, date)

    stats.workingHours = workingHours
    await stats.save()

    res.status(200).json({ message: "Working hours synced successfully", stats })
  } catch (error) {
    console.error("Error syncing working hours:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

module.exports = router
