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

        // Use atomic operation to check and update timeout status
        const updatedOrder = await Order.findOneAndUpdate(
          {
            _id: orderId,
            status: "PENDING", // Only timeout if still pending
          },
          {
            $set: { status: "TIMEOUT" },
            $push: {
              statusHistory: {
                email: "system",
                status: "TIMEOUT",
                updatedAt: new Date(),
              },
            },
          },
          { new: true },
        )

        if (updatedOrder) {
          // Notify customer about timeout
          io.to(updatedOrder.userEmail).emit("order-timeout", {
            message: "No delivery partners available at the moment",
            order: updatedOrder,
            supportContact: {
              phone: "+91 9876543210", // Replace with actual support number
              message: "Contact support for immediate assistance",
            },
          })

          console.log(`📞 Order ${orderId} timed out - customer notified`)
        } else {
          console.log(`Order ${orderId} was already accepted/cancelled - timeout ignored`)
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

// Helper function to notify partners about order being unavailable
function notifyPartnersOrderUnavailable(io, activePartners, excludeEmail, orderId, assignedTo) {
  activePartners.forEach((partner) => {
    if (partner.email !== excludeEmail) {
      io.to(partner.email).emit("order-no-longer-available", {
        message: "Order has been assigned to another partner",
        orderId: orderId,
        assignedTo: assignedTo,
        action: "hide_order", // Instruction to hide the order from UI
      })
    }
  })
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
        timestamp: new Date().toISOString(),
      })
    })

    console.log(`📦 New order ${newOrder._id} created and sent to ${activePartners.length} partners`)
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

    // Handle CONFIRMED status with enhanced atomic operation and race condition prevention
    if (status === "CONFIRMED") {
      console.log(`🎯 Partner ${updatedByEmail} attempting to accept order ${req.params.id}`)

      // First, check if the partner has already rejected this order
      const existingOrder = await Order.findById(req.params.id)
      if (!existingOrder) {
        return res.status(404).json({ message: "Order not found." })
      }

      // Check if partner already rejected this order
      const hasRejected = existingOrder.statusHistory.some(
        (entry) => entry.email === updatedByEmail && entry.status === "CANCELLED",
      )

      if (hasRejected) {
        return res.status(400).json({
          message: "You have already rejected this order and cannot accept it.",
          success: false,
        })
      }

      // Use atomic operation with multiple conditions to ensure only one partner can accept
      const updatedOrder = await Order.findOneAndUpdate(
        {
          _id: req.params.id,
          status: "PENDING", // Must be pending
          $nor: [
            { "statusHistory.status": "CONFIRMED" }, // No confirmed entries
            { "statusHistory.email": updatedByEmail, "statusHistory.status": "CANCELLED" }, // Partner hasn't rejected
          ],
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
        console.log(
          `❌ Partner ${updatedByEmail} failed to accept order ${req.params.id} - race condition or already accepted`,
        )
        return res.status(409).json({
          message: "Order already accepted by another partner or you have previously rejected it.",
          success: false,
          action: "hide_order", // Tell frontend to hide this order
        })
      }

      // Clear timeout since order was accepted
      clearOrderTimeout(updatedOrder._id.toString())

      // Update delivery partner stats for CONFIRMED order
      await updateDeliveryPartnerStats(updatedByEmail, "CONFIRMED", updatedOrder.createdAt)

      // Get all active partners for notifications
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

      // Notify all other partners that this order is no longer available
      notifyPartnersOrderUnavailable(req.io, activePartners, updatedByEmail, updatedOrder._id, updatedByEmail)

      // Notify customer about acceptance
      req.io.to(updatedOrder.userEmail).emit("order-status-updated", {
        message: "Your order has been confirmed by a delivery partner",
        order: updatedOrder,
      })

      // Notify the accepting partner
      req.io.to(updatedByEmail).emit("order-status-updated", {
        message: "Order confirmed successfully",
        order: updatedOrder,
      })

      console.log(`✅ Order ${updatedOrder._id} SUCCESSFULLY assigned to ${updatedByEmail}`)
      return res.status(200).json({
        ...updatedOrder.toObject(),
        success: true,
        message: "Order accepted successfully!",
      })
    }

    // For all other status updates (CANCELLED, DELIVERED, etc.)
    const order = await Order.findById(req.params.id)
    if (!order) {
      return res.status(404).json({ message: "Order not found." })
    }

    if (!order.rejectedByEmails) order.rejectedByEmails = []
    if (!order.statusHistory) order.statusHistory = []

    const currentlyAssignedEmail = getAssignedEmail(order)
    const currentEffectiveStatus = getCurrentStatus(order)

    if (status === "CANCELLED") {
      // Prevent cancellation of already confirmed orders by non-assigned partners
      if (currentEffectiveStatus === "CONFIRMED" && currentlyAssignedEmail !== updatedByEmail) {
        return res.status(403).json({
          message: "Only the assigned delivery partner can cancel a confirmed order.",
          action: "hide_order", // Hide order from this partner's view
        })
      }

      if (currentEffectiveStatus === "DELIVERED") {
        return res.status(400).json({ message: "Cannot cancel a delivered order." })
      }

      if (hasUserCancelled(order, updatedByEmail)) {
        return res.status(400).json({ message: "You have already rejected this order." })
      }

      // Use atomic operation for cancellation to prevent race conditions
      const cancelledOrder = await Order.findOneAndUpdate(
        {
          _id: req.params.id,
          $nor: [{ "statusHistory.email": updatedByEmail, "statusHistory.status": "CANCELLED" }],
        },
        {
          $push: {
            statusHistory: {
              email: updatedByEmail,
              status: "CANCELLED",
              updatedAt: new Date(),
            },
            rejectedByEmails: updatedByEmail,
          },
        },
        { new: true },
      )

      if (!cancelledOrder) {
        return res.status(400).json({ message: "You have already rejected this order." })
      }

      // Update delivery partner stats for CANCELLED order
      await updateDeliveryPartnerStats(updatedByEmail, "CANCELLED", cancelledOrder.createdAt)

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

      // If assigned partner cancelled, make order available again
      if (currentlyAssignedEmail === updatedByEmail) {
        await Order.findByIdAndUpdate(req.params.id, { status: "PENDING" })

        // Notify other available partners
        activePartners.forEach((partner) => {
          if (partner.email !== updatedByEmail && !cancelledOrder.rejectedByEmails.includes(partner.email)) {
            req.io.to(partner.email).emit("order-available-again", {
              message: "Order is available again",
              order: { ...cancelledOrder.toObject(), status: "PENDING" },
            })
          }
        })
        console.log(`🔄 Order ${cancelledOrder._id} made available again after ${updatedByEmail} cancelled`)
      } else {
        // Check if all active partners have rejected
        const allRejected =
          activePartnerEmails.length > 0 &&
          activePartnerEmails.every((email) => cancelledOrder.rejectedByEmails.includes(email))

        if (allRejected) {
          await Order.findByIdAndUpdate(req.params.id, { status: "CANCELLED" })
          clearOrderTimeout(cancelledOrder._id.toString())
          console.log(`❌ Order ${cancelledOrder._id} cancelled - all partners rejected`)
        }
      }

      // Get updated order
      const finalOrder = await Order.findById(req.params.id)

      // Notify customer and assigned partner (if any)
      req.io.to(finalOrder.userEmail).emit("order-status-updated", {
        message: "Order status updated",
        order: finalOrder,
      })

      const assignedEmail = getAssignedEmail(finalOrder)
      if (assignedEmail && assignedEmail !== finalOrder.userEmail) {
        req.io.to(assignedEmail).emit("order-status-updated", {
          message: "Order status updated",
          order: finalOrder,
        })
      }

      console.log(`Order ${finalOrder._id} status updated by ${updatedByEmail} to ${status}`)
      return res.status(200).json(finalOrder)
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

    // Reset order to PENDING with atomic operation
    const retriedOrder = await Order.findOneAndUpdate(
      { _id: req.params.id, status: "TIMEOUT" },
      {
        $set: {
          status: "PENDING",
          rejectedByEmails: [], // Reset rejected emails for retry
        },
        $push: {
          statusHistory: {
            email: "system",
            status: "RETRY",
            updatedAt: new Date(),
          },
        },
      },
      { new: true },
    )

    if (!retriedOrder) {
      return res.status(400).json({ message: "Order cannot be retried at this time." })
    }

    // Set new timeout for retry
    setOrderTimeout(retriedOrder._id.toString(), req.io)

    // Notify all active partners about the retry
    activePartners.forEach((partner) => {
      req.io.to(partner.email).emit("new-order", {
        message: "Order retry - New order received",
        order: retriedOrder,
        isRetry: true,
        timestamp: new Date().toISOString(),
      })
    })

    // Notify customer about retry
    req.io.to(retriedOrder.userEmail).emit("order-status-updated", {
      message: "Your order has been resubmitted to delivery partners",
      order: retriedOrder,
    })

    console.log(`🔄 Order ${retriedOrder._id} retried successfully`)
    res.status(200).json({ message: "Order retried successfully!", order: retriedOrder })
  } catch (error) {
    console.error("Error retrying order:", error)
    res.status(500).json({ message: "Internal Server Error" })
  }
})

module.exports = router
