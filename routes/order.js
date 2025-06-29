const express = require("express")
const router = express.Router()
const Order = require("../models/Order")
const DeliveryPartnerDutyStatus = require("../models/DeliveryPartnerDutyStatus")
const DeliveryPartnerStats = require("../models/DeliveryPartnerStats")

// Store active order timeouts
const orderTimeouts = new Map()

function formatDate(date) {
  return date.toISOString().split("T")[0] // YYYY-MM-DD
}

// Helper function to clear order timeout
function clearOrderTimeout(orderId) {
  if (orderTimeouts.has(orderId)) {
    clearTimeout(orderTimeouts.get(orderId))
    orderTimeouts.delete(orderId)
    console.log(`⏰ Timeout cleared for order ${orderId}`)
  }
}

// Helper function to set order timeout (2 minutes)
function setOrderTimeout(orderId, io) {
  const timeoutId = setTimeout(
    async () => {
      try {
        console.log(`⏰ Order ${orderId} timeout triggered - no partners accepted within 2 minutes`)

        const order = await Order.findById(orderId)
        if (!order) {
          console.log(`Order ${orderId} not found during timeout`)
          return
        }

        // Only timeout if order is still PENDING
        if (order.status === "PENDING") {
          order.status = "TIMEOUT"
          order.statusHistory.push({
            email: "system",
            status: "TIMEOUT",
            updatedAt: new Date(),
          })

          await order.save()

          // Notify customer about timeout
          io.to(order.userEmail).emit("order-timeout", {
            message: "No delivery partners available at the moment",
            order: order,
            supportContact: {
              phone: "+91 9876543210", // Replace with actual support number
              message: "Contact support for immediate assistance",
            },
          })

          console.log(`📞 Order ${orderId} timed out - customer notified`)
        }

        // Remove from timeout map
        orderTimeouts.delete(orderId)
      } catch (error) {
        console.error(`Error handling timeout for order ${orderId}:`, error)
      }
    },
    2 * 60 * 1000,
  ) // 2 minutes in milliseconds

  orderTimeouts.set(orderId, timeoutId)
  console.log(`⏰ Timeout set for order ${orderId} - 2 minutes`)
}

// Helper function to update delivery partner stats
async function updateDeliveryPartnerStats(email, action, orderDate) {
  try {
    const date = formatDate(new Date(orderDate))
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
    }

    const dutyRecord = await DeliveryPartnerDutyStatus.findOne({ email })
    if (dutyRecord) {
      const dateLog = dutyRecord.statusLog.find((log) => log.date === date)
      if (dateLog && dateLog.sessions.length > 0) {
        const totalHours = dateLog.sessions.reduce((total, session) => {
          return total + (session.workingHours || 0)
        }, 0)
        stats.workingHours = totalHours > 0 ? totalHours : null
      }
    }

    if (action === "COMPLETED" || action === "DELIVERED") {
      stats.completedOrders += 1
    } else if (action === "REJECTED" || action === "CANCELLED") {
      stats.rejectedOrders += 1
    }

    await stats.save()
    console.log(`📊 Stats updated for ${email} on ${date}: ${action}`)
  } catch (error) {
    console.error("Error updating delivery partner stats:", error)
  }
}

// Helper function to get assigned email from statusHistory
function getAssignedEmail(order) {
  const confirmedEntry = order.statusHistory
    .filter((entry) => entry.status === "CONFIRMED")
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0]
  return confirmedEntry ? confirmedEntry.email : null
}

// Helper function to get the current effective status
function getCurrentStatus(order) {
  if (!order.statusHistory || order.statusHistory.length === 0) {
    return order.status
  }

  const deliveredEntry = order.statusHistory
    .filter((entry) => entry.status === "DELIVERED")
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0]
  if (deliveredEntry) return "DELIVERED"

  const confirmedEntry = order.statusHistory
    .filter((entry) => entry.status === "CONFIRMED")
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0]
  if (confirmedEntry) return "CONFIRMED"

  return order.status
}

// Helper function to check if all active partners have rejected
function areAllPartnersRejected(order, activePartnerEmails) {
  const rejectedEmails = order.statusHistory.filter((entry) => entry.status === "CANCELLED").map((entry) => entry.email)
  return activePartnerEmails.every((email) => rejectedEmails.includes(email))
}

// Helper function to check if user has confirmed this order
function hasUserConfirmed(order, userEmail) {
  return order.statusHistory.some((entry) => entry.email === userEmail && entry.status === "CONFIRMED")
}

// Helper function to check if user has cancelled this order
function hasUserCancelled(order, userEmail) {
  return order.statusHistory.some((entry) => entry.email === userEmail && entry.status === "CANCELLED")
}

// POST /orders
router.post("/", async (req, res) => {
  try {
    const { products, address, userEmail } = req.body

    if (!products?.length || !address || !userEmail) {
      return res.status(400).json({ message: "Missing required fields." })
    }

    const today = formatDate(new Date())
    const activePartners = await DeliveryPartnerDutyStatus.find({
      statusLog: {
        $elemMatch: {
          date: today,
          sessions: {
            $elemMatch: {
              dutyTrue: { $ne: null },
              dutyFalse: null,
            },
          },
        },
      },
    })

    if (!activePartners.length) {
      return res.status(403).json({ message: "No delivery partners available" })
    }

    const newOrder = new Order({
      products,
      address,
      userEmail,
      status: "PENDING",
      rejectedByEmails: [],
      statusHistory: [],
    })

    await newOrder.save()

    // Set 2-minute timeout for this order
    setOrderTimeout(newOrder._id.toString(), req.io)

    // Notify all active partners
    activePartners.forEach((partner) => {
      req.io.to(partner.email).emit("new-order", {
        message: "New order received",
        order: newOrder,
      })
    })

    res.status(201).json({ message: "Order placed successfully!", order: newOrder })
  } catch (error) {
    console.error("Order creation failed:", error)
    res.status(500).json({ message: "Internal Server Error" })
  }
})

// GET /orders — Get all orders (newest first)
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 })
    res.status(200).json(orders)
  } catch (error) {
    console.error("Error fetching orders:", error)
    res.status(500).json({ message: "Internal Server Error" })
  }
})

// GET /orders/:email — Get all orders where this email is involved
router.get("/:email", async (req, res) => {
  try {
    const email = req.params.email
    const orders = await Order.find({
      $or: [{ userEmail: email }, { "statusHistory.email": email }],
    }).sort({ createdAt: -1 })

    if (!orders.length) {
      return res.status(404).json({ message: "No orders found for this email." })
    }

    res.status(200).json(orders)
  } catch (error) {
    console.error("Error fetching orders by email:", error)
    res.status(500).json({ message: "Internal Server Error" })
  }
})

// PATCH /orders/:id/status
router.patch("/:id/status", async (req, res) => {
  try {
    const { status, updatedByEmail } = req.body

    if (!status || !updatedByEmail) {
      return res.status(400).json({ message: "Status and updatedByEmail are required." })
    }

    const validStatuses = ["PENDING", "CONFIRMED", "CANCELLED", "DELIVERED", "TIMEOUT"]
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." })
    }

    // Handle CONFIRMED status with atomic operation
    if (status === "CONFIRMED") {
      const updatedOrder = await Order.findOneAndUpdate(
        {
          _id: req.params.id,
          status: "PENDING",
          $nor: [{ "statusHistory.status": "CONFIRMED" }],
        },
        {
          $set: { status: "CONFIRMED" },
          $push: {
            statusHistory: {
              email: updatedByEmail,
              status: "CONFIRMED",
              updatedAt: new Date(),
            },
          },
        },
        { new: true },
      )

      if (!updatedOrder) {
        return res.status(409).json({
          message: "Order already accepted by another captain.",
          success: false,
        })
      }

      // Clear timeout since order was accepted
      clearOrderTimeout(updatedOrder._id.toString())

      // Update delivery partner stats for CONFIRMED order
      await updateDeliveryPartnerStats(updatedByEmail, "CONFIRMED", updatedOrder.createdAt)

      const today = formatDate(new Date())
      const activePartners = await DeliveryPartnerDutyStatus.find({
        statusLog: {
          $elemMatch: {
            date: today,
            sessions: {
              $elemMatch: {
                dutyTrue: { $ne: null },
                dutyFalse: null,
              },
            },
          },
        },
      })

      // Notify other partners
      activePartners.forEach((partner) => {
        if (partner.email !== updatedByEmail) {
          req.io.to(partner.email).emit("order-assigned", {
            message: "Order has been assigned to another partner",
            orderId: updatedOrder._id,
            assignedTo: updatedByEmail,
          })
        }
      })

      // Notify customer and assigned partner
      req.io.to(updatedOrder.userEmail).emit("order-status-updated", {
        message: "Your order has been confirmed by a delivery partner",
        order: updatedOrder,
      })
      req.io.to(updatedByEmail).emit("order-status-updated", {
        message: "Order confirmed successfully",
        order: updatedOrder,
      })

      console.log(`🎯 Order ${updatedOrder._id} ATOMICALLY assigned to ${updatedByEmail}`)
      return res.status(200).json({
        ...updatedOrder.toObject(),
        success: true,
        message: "Order accepted successfully!",
      })
    }

    // For all other status updates
    const order = await Order.findById(req.params.id)
    if (!order) {
      return res.status(404).json({ message: "Order not found." })
    }

    if (!order.rejectedByEmails) order.rejectedByEmails = []
    if (!order.statusHistory) order.statusHistory = []

    const currentlyAssignedEmail = getAssignedEmail(order)
    const currentEffectiveStatus = getCurrentStatus(order)
    const today = formatDate(new Date())
    const activePartners = await DeliveryPartnerDutyStatus.find({
      statusLog: {
        $elemMatch: {
          date: today,
          sessions: {
            $elemMatch: {
              dutyTrue: { $ne: null },
              dutyFalse: null,
            },
          },
        },
      },
    })
    const activePartnerEmails = activePartners.map((partner) => partner.email)

    if (status === "CANCELLED") {
      if (currentEffectiveStatus === "DELIVERED") {
        return res.status(400).json({ message: "Cannot cancel a delivered order." })
      }

      if (hasUserCancelled(order, updatedByEmail)) {
        return res.status(400).json({ message: "You have already rejected this order." })
      }

      // Update delivery partner stats for CANCELLED order
      await updateDeliveryPartnerStats(updatedByEmail, "CANCELLED", order.createdAt)

      if (!order.rejectedByEmails.includes(updatedByEmail)) {
        order.rejectedByEmails.push(updatedByEmail)
      }

      if (currentlyAssignedEmail === updatedByEmail) {
        order.status = "PENDING"
        activePartners.forEach((partner) => {
          if (partner.email !== updatedByEmail && !order.rejectedByEmails.includes(partner.email)) {
            req.io.to(partner.email).emit("order-available-again", {
              message: "Order is available again",
              order: order,
            })
          }
        })
        console.log(`🔄 Order ${order._id} made available again after ${updatedByEmail} cancelled`)
      } else {
        const tempStatusHistory = [
          ...order.statusHistory,
          {
            email: updatedByEmail,
            status: "CANCELLED",
            updatedAt: new Date(),
          },
        ]
        const rejectedEmails = tempStatusHistory
          .filter((entry) => entry.status === "CANCELLED")
          .map((entry) => entry.email)

        if (activePartnerEmails.length > 0 && activePartnerEmails.every((email) => rejectedEmails.includes(email))) {
          order.status = "CANCELLED"
          // Clear timeout if all partners rejected
          clearOrderTimeout(order._id.toString())
        } else {
          order.status = "PENDING"
        }
      }
    } else if (status === "DELIVERED") {
      if (currentlyAssignedEmail !== updatedByEmail) {
        return res.status(403).json({ message: "Only the assigned delivery partner can mark order as delivered." })
      }

      if (currentEffectiveStatus !== "CONFIRMED") {
        return res.status(400).json({ message: "Order must be confirmed before it can be delivered." })
      }

      // Update delivery partner stats for DELIVERED order
      await updateDeliveryPartnerStats(updatedByEmail, "DELIVERED", order.createdAt)
      order.status = "DELIVERED"

      // Clear timeout since order is completed
      clearOrderTimeout(order._id.toString())
    } else if (status === "PENDING") {
      if (currentEffectiveStatus === "DELIVERED") {
        return res.status(400).json({ message: "Cannot change status of a delivered order back to pending." })
      }
      order.status = "PENDING"
    }

    order.statusHistory.push({
      email: updatedByEmail,
      status,
      updatedAt: new Date(),
    })

    await order.save()

    // Emit updates to relevant users
    req.io.to(order.userEmail).emit("order-status-updated", {
      message: "Order status updated",
      order,
    })

    const assignedEmail = getAssignedEmail(order)
    if (assignedEmail && assignedEmail !== order.userEmail) {
      req.io.to(assignedEmail).emit("order-status-updated", {
        message: "Order status updated",
        order,
      })
    }

    console.log(`Order ${order._id} status updated by ${updatedByEmail} to ${status}`)
    res.status(200).json(order)
  } catch (error) {
    console.error("Error updating order status:", error)
    res.status(500).json({ message: "Internal Server Error", error: error.message })
  }
})

// GET /orders/active/:email — Get active orders for a delivery partner
router.get("/active/:email", async (req, res) => {
  try {
    const email = req.params.email
    const confirmedOrders = await Order.find({ status: "CONFIRMED" })
    const assignedOrders = confirmedOrders.filter((order) => {
      const confirmedEntries = order.statusHistory
        .filter((entry) => entry.status === "CONFIRMED")
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      return confirmedEntries.length && confirmedEntries[0].email === email
    })

    if (!assignedOrders.length) {
      return res.status(404).json({ message: "No active orders found for this email." })
    }

    res.status(200).json(assignedOrders)
  } catch (error) {
    console.error("Error fetching active orders for email:", error)
    res.status(500).json({ message: "Internal Server Error" })
  }
})

// POST /orders/:id/retry - Retry a timed out order
router.post("/:id/retry", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)

    if (!order) {
      return res.status(404).json({ message: "Order not found." })
    }

    if (order.status !== "TIMEOUT") {
      return res.status(400).json({ message: "Only timed out orders can be retried." })
    }

    // Check if there are active partners available
    const today = formatDate(new Date())
    const activePartners = await DeliveryPartnerDutyStatus.find({
      statusLog: {
        $elemMatch: {
          date: today,
          sessions: {
            $elemMatch: {
              dutyTrue: { $ne: null },
              dutyFalse: null,
            },
          },
        },
      },
    })

    if (!activePartners.length) {
      return res.status(403).json({ message: "No delivery partners available at the moment" })
    }

    // Reset order to PENDING
    order.status = "PENDING"
    order.rejectedByEmails = [] // Reset rejected emails for retry
    order.statusHistory.push({
      email: "system",
      status: "RETRY",
      updatedAt: new Date(),
    })

    await order.save()

    // Set new timeout for retry
    setOrderTimeout(order._id.toString(), req.io)

    // Notify all active partners about the retry
    activePartners.forEach((partner) => {
      req.io.to(partner.email).emit("new-order", {
        message: "Order retry - New order received",
        order: order,
        isRetry: true,
      })
    })

    // Notify customer about retry
    req.io.to(order.userEmail).emit("order-status-updated", {
      message: "Your order has been resubmitted to delivery partners",
      order: order,
    })

    console.log(`🔄 Order ${order._id} retried successfully`)
    res.status(200).json({ message: "Order retried successfully!", order })
  } catch (error) {
    console.error("Error retrying order:", error)
    res.status(500).json({ message: "Internal Server Error" })
  }
})

module.exports = router
