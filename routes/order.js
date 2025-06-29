const express = require("express")
const router = express.Router()
const Order = require("../models/Order")
const DeliveryPartnerDutyStatus = require("../models/DeliveryPartnerDutyStatus")

function formatDate(date) {
  return date.toISOString().split("T")[0] // YYYY-MM-DD
}

// Helper function to get assigned email from statusHistory
function getAssignedEmail(order) {
  // Find the most recent CONFIRMED status in statusHistory
  const confirmedEntry = order.statusHistory
    .filter((entry) => entry.status === "CONFIRMED")
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0]
  return confirmedEntry ? confirmedEntry.email : null
}

// Helper function to check if all active partners have rejected
function areAllPartnersRejected(order, activePartnerEmails) {
  const rejectedEmails = order.statusHistory.filter((entry) => entry.status === "CANCELLED").map((entry) => entry.email)

  // Check if all active partners have rejected
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
    // Sort by createdAt in descending order (newest first)
    const orders = await Order.find().sort({ createdAt: -1 })
    res.status(200).json(orders)
  } catch (error) {
    console.error("Error fetching orders:", error)
    res.status(500).json({ message: "Internal Server Error" })
  }
})

// GET /orders/:email — Get orders by user email (newest first)
router.get("/:email", async (req, res) => {
  try {
    const email = req.params.email
    // Sort by createdAt in descending order (newest first)
    const orders = await Order.find({ userEmail: email }).sort({ createdAt: -1 })

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

    // Validate required fields
    if (!status || !updatedByEmail) {
      return res.status(400).json({ message: "Status and updatedByEmail are required." })
    }

    // Updated valid statuses to include DELIVERED
    const validStatuses = ["PENDING", "CONFIRMED", "CANCELLED", "DELIVERED"]
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." })
    }

    const order = await Order.findById(req.params.id)
    if (!order) {
      return res.status(404).json({ message: "Order not found." })
    }

    // Initialize arrays if they don't exist (for backward compatibility)
    if (!order.rejectedByEmails) {
      order.rejectedByEmails = []
    }
    if (!order.statusHistory) {
      order.statusHistory = []
    }

    // Get currently assigned email from statusHistory
    const currentlyAssignedEmail = getAssignedEmail(order)

    // Get active partners for checking if all rejected
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

    // Handle CONFIRMED status (Accept)
    if (status === "CONFIRMED") {
      // If already assigned to someone else, no one else can accept it
      if (currentlyAssignedEmail && currentlyAssignedEmail !== updatedByEmail) {
        return res.status(409).json({ message: "Order already accepted by another captain." })
      }

      // Check if order is already delivered
      if (order.status === "DELIVERED") {
        return res.status(400).json({ message: "Cannot confirm a delivered order." })
      }

      // Check if this partner already rejected this order
      if (hasUserCancelled(order, updatedByEmail)) {
        return res.status(400).json({ message: "You have already rejected this order." })
      }

      // Update main status to CONFIRMED
      order.status = "CONFIRMED"
    }

    // Handle CANCELLED status (Reject)
    else if (status === "CANCELLED") {
      // Check if order is already delivered
      if (order.status === "DELIVERED") {
        return res.status(400).json({ message: "Cannot cancel a delivered order." })
      }

      // Check if this partner already rejected this order
      if (hasUserCancelled(order, updatedByEmail)) {
        return res.status(400).json({ message: "You have already rejected this order." })
      }

      // Add to rejected list if not already there
      if (!order.rejectedByEmails.includes(updatedByEmail)) {
        order.rejectedByEmails.push(updatedByEmail)
      }

      // If the person rejecting is the one who confirmed it, change main status to CANCELLED
      if (currentlyAssignedEmail === updatedByEmail) {
        order.status = "CANCELLED"
      }
      // If this rejection means all active partners have rejected, mark as CANCELLED
      else {
        // Add this rejection to status history first (temporarily)
        const tempStatusHistory = [
          ...order.statusHistory,
          {
            email: updatedByEmail,
            status: "CANCELLED",
            updatedAt: new Date(),
          },
        ]

        // Check if all partners have now rejected
        const rejectedEmails = tempStatusHistory
          .filter((entry) => entry.status === "CANCELLED")
          .map((entry) => entry.email)

        if (activePartnerEmails.length > 0 && activePartnerEmails.every((email) => rejectedEmails.includes(email))) {
          order.status = "CANCELLED"
        } else {
          order.status = "PENDING" // Keep as PENDING if not all partners have rejected
        }
      }
    }

    // Handle DELIVERED status
    else if (status === "DELIVERED") {
      // Only the assigned person can mark as delivered
      if (currentlyAssignedEmail !== updatedByEmail) {
        return res.status(403).json({ message: "Only the assigned delivery partner can mark order as delivered." })
      }

      // Order must be confirmed before it can be delivered
      if (order.status !== "CONFIRMED") {
        return res.status(400).json({ message: "Order must be confirmed before it can be delivered." })
      }

      // Update main status to DELIVERED
      order.status = "DELIVERED"
    }

    // Handle PENDING status
    else if (status === "PENDING") {
      // Only allow if current status is not DELIVERED
      if (order.status === "DELIVERED") {
        return res.status(400).json({ message: "Cannot change status of a delivered order back to pending." })
      }

      // Update main status to PENDING
      order.status = "PENDING"
    }

    // Add to status history
    order.statusHistory.push({
      email: updatedByEmail,
      status,
      updatedAt: new Date(),
    })

    await order.save()

    console.log(`Order ${order._id} status updated:`)
    console.log(`- Main status: ${order.status}`)
    console.log(`- Action taken: ${status} by ${updatedByEmail}`)
    console.log(`- Active partners: ${activePartnerEmails.length}`)
    console.log(`- Rejected by: ${order.rejectedByEmails.length} partners`)

    // Emit socket event
    req.io.emit("order-status-updated", {
      message: "Order status updated",
      order,
    })

    res.status(200).json(order)
  } catch (error) {
    console.error("Error updating order status:", error)
    res.status(500).json({ message: "Internal Server Error", error: error.message })
  }
})

// GET /orders/active/:email — Get active (accepted but not delivered) orders for a delivery partner
router.get("/active/:email", async (req, res) => {
  try {
    const email = req.params.email;

    // Find all orders with status CONFIRMED
    const confirmedOrders = await Order.find({ status: "CONFIRMED" });

    // Filter orders where the latest CONFIRMED status in history is by this email
    const assignedOrders = confirmedOrders.filter((order) => {
      const confirmedEntries = order.statusHistory
        .filter((entry) => entry.status === "CONFIRMED")
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)); // Newest first

      return confirmedEntries.length && confirmedEntries[0].email === email;
    });

    if (!assignedOrders.length) {
      return res.status(404).json({ message: "No active orders found for this email." });
    }

    res.status(200).json(assignedOrders);
  } catch (error) {
    console.error("Error fetching active orders for email:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


module.exports = router
