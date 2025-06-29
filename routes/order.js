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
    const { status, updatedByEmail } = req.body;

    if (!status || !updatedByEmail) {
      return res.status(400).json({ message: "Status and updatedByEmail are required." });
    }

    const validStatuses = ["PENDING", "CONFIRMED", "CANCELLED", "DELIVERED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (!order.rejectedByEmails) order.rejectedByEmails = [];
    if (!order.statusHistory) order.statusHistory = [];

    const currentlyAssignedEmail = getAssignedEmail(order);
    const today = formatDate(new Date());

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
    });
    const activePartnerEmails = activePartners.map((partner) => partner.email);

    if (status === "CONFIRMED") {
      if (currentlyAssignedEmail && currentlyAssignedEmail !== updatedByEmail) {
        return res.status(409).json({ message: "Order already accepted by another captain." });
      }
      if (order.status === "DELIVERED") {
        return res.status(400).json({ message: "Cannot confirm a delivered order." });
      }
      if (hasUserCancelled(order, updatedByEmail)) {
        return res.status(400).json({ message: "You have already rejected this order." });
      }

      order.status = "CONFIRMED";
    } else if (status === "CANCELLED") {
      if (order.status === "DELIVERED") {
        return res.status(400).json({ message: "Cannot cancel a delivered order." });
      }
      if (hasUserCancelled(order, updatedByEmail)) {
        return res.status(400).json({ message: "You have already rejected this order." });
      }

      if (!order.rejectedByEmails.includes(updatedByEmail)) {
        order.rejectedByEmails.push(updatedByEmail);
      }

      if (currentlyAssignedEmail === updatedByEmail) {
        order.status = "CANCELLED";
      } else {
        const tempStatusHistory = [
          ...order.statusHistory,
          {
            email: updatedByEmail,
            status: "CANCELLED",
            updatedAt: new Date(),
          },
        ];

        const rejectedEmails = tempStatusHistory
          .filter((entry) => entry.status === "CANCELLED")
          .map((entry) => entry.email);

        if (activePartnerEmails.length > 0 && activePartnerEmails.every((email) => rejectedEmails.includes(email))) {
          order.status = "CANCELLED";
        } else {
          order.status = "PENDING";
        }
      }
    } else if (status === "DELIVERED") {
      if (currentlyAssignedEmail !== updatedByEmail) {
        return res.status(403).json({ message: "Only the assigned delivery partner can mark order as delivered." });
      }
      if (order.status !== "CONFIRMED") {
        return res.status(400).json({ message: "Order must be confirmed before it can be delivered." });
      }

      order.status = "DELIVERED";
    } else if (status === "PENDING") {
      if (order.status === "DELIVERED") {
        return res.status(400).json({ message: "Cannot change status of a delivered order back to pending." });
      }

      order.status = "PENDING";
    }

    order.statusHistory.push({
      email: updatedByEmail,
      status,
      updatedAt: new Date(),
    });

    await order.save();

    console.log(`Order ${order._id} status updated by ${updatedByEmail} to ${status}`);

    // ✅ Emit update only to relevant users
    // 1. To the customer
    req.io.to(order.userEmail).emit("order-status-updated", {
      message: "Order status updated",
      order,
    });

    // 2. To the assigned captain
    const assignedEmail = getAssignedEmail(order);
    if (assignedEmail && assignedEmail !== order.userEmail) {
      req.io.to(assignedEmail).emit("order-status-updated", {
        message: "Order status updated",
        order,
      });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});


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
