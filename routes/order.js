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
    .filter(entry => entry.status === 'CONFIRMED')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0]
  
  return confirmedEntry ? confirmedEntry.email : null
}

// Helper function to check if user has confirmed this order
function hasUserConfirmed(order, userEmail) {
  return order.statusHistory.some(entry => 
    entry.email === userEmail && entry.status === 'CONFIRMED'
  )
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
      rejectedByEmails: [], // Initialize empty array
      statusHistory: [], // Initialize empty array
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

// GET /orders — Get all orders
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 })
    res.status(200).json(orders)
  } catch (error) {
    console.error("Error fetching orders:", error)
    res.status(500).json({ message: "Internal Server Error" })
  }
})

// GET /orders/:email — Get orders by user email
router.get("/:email", async (req, res) => {
  try {
    const email = req.params.email
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

    const validStatuses = ["PENDING", "CONFIRMED", "CANCELLED"]

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

    // Handle CONFIRMED status
    if (status === "CONFIRMED") {
      // If already assigned to someone else, no one else can accept it
      if (currentlyAssignedEmail && currentlyAssignedEmail !== updatedByEmail) {
        return res.status(409).json({ message: "Order already accepted by another captain." })
      }

      order.status = "CONFIRMED"
    }
    // Handle CANCELLED status (rejection)
    else if (status === "CANCELLED") {
      // Add to rejected list if not already there
      if (!order.rejectedByEmails.includes(updatedByEmail)) {
        order.rejectedByEmails.push(updatedByEmail)
      }

      // Only change status to CANCELLED if the person rejecting is the one who confirmed it
      if (currentlyAssignedEmail === updatedByEmail) {
        order.status = "CANCELLED"
      }
      // If not assigned to anyone or assigned to someone else, just add to rejected list (status stays PENDING)
    }

    // Add to status history
    order.statusHistory.push({
      email: updatedByEmail,
      status,
      updatedAt: new Date(),
    })

    await order.save()

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

module.exports = router
