const express = require("express");
const { attachWorkspace } = require("../middleware/auth");
const { uploadPackage, uploadDestination, uploadAvatar, uploadAgent } = require("../middleware/upload");

const auth = require("../controllers/authController");
const dashboard = require("../controllers/dashboardController");
const clients = require("../controllers/clientsController");
const bookings = require("../controllers/bookingsController");
const packages = require("../controllers/packagesController");
const leads = require("../controllers/leadsController");
const followUps = require("../controllers/followUpsController");
const messages = require("../controllers/messagesController");
const destinations = require("../controllers/destinationsController");
const agents = require("../controllers/agentsController");
const reports = require("../controllers/reportsController");
const misc = require("../controllers/miscController");

const router = express.Router();

router.use(attachWorkspace);

router.get("/profile", auth.me);
router.patch("/profile", uploadAvatar.single("avatar"), auth.updateProfile);

router.get("/dashboard/stats", dashboard.stats);
router.get("/dashboard/bookings-overview", dashboard.bookingsOverview);
router.get("/dashboard/package-categories", dashboard.packageCategories);
router.get("/dashboard/recent-clients", dashboard.recentClients);
router.get("/dashboard/upcoming-bookings", dashboard.upcomingBookings);
router.get("/dashboard/top-destinations", dashboard.topDestinations);
router.get("/search", dashboard.search);

router.get("/clients", clients.list);
router.get("/clients/:id", clients.getOne);
router.post("/clients", clients.create);
router.put("/clients/:id", clients.update);
router.delete("/clients/:id", clients.remove);

router.get("/bookings", bookings.list);
router.get("/bookings/:id", bookings.getOne);
router.post("/bookings", bookings.create);
router.put("/bookings/:id", bookings.update);
router.patch("/bookings/:id/status", bookings.patchStatus);
router.patch("/bookings/:id/agent", bookings.patchAgent);
router.delete("/bookings/:id", bookings.remove);

router.get("/packages", packages.list);
router.get("/packages/:id", packages.getOne);
router.post("/packages", uploadPackage.single("image"), packages.create);
router.put("/packages/:id", uploadPackage.single("image"), packages.update);
router.patch("/packages/:id/status", packages.patchStatus);
router.delete("/packages/:id", packages.remove);

router.get("/leads", leads.list);
router.get("/leads/:id", leads.getOne);
router.post("/leads", leads.create);
router.put("/leads/:id", leads.update);
router.patch("/leads/:id", leads.patchStatus);
router.post("/leads/:id/convert", leads.convert);
router.delete("/leads/:id", leads.remove);

router.get("/follow-ups", followUps.list);
router.get("/follow-ups/:id", followUps.getOne);
router.post("/follow-ups", followUps.create);
router.put("/follow-ups/:id", followUps.update);
router.patch("/follow-ups/:id/complete", followUps.complete);
router.patch("/follow-ups/:id/reschedule", followUps.reschedule);
router.delete("/follow-ups/:id", followUps.remove);

router.get("/messages/unread-count", messages.unreadCount);
router.get("/messages/conversations", messages.conversations);
router.get("/messages/conversations/:id", messages.thread);
router.post("/messages", messages.send);

router.get("/destinations", destinations.list);
router.post("/destinations", uploadDestination.single("image"), destinations.create);
router.put("/destinations/:id", uploadDestination.single("image"), destinations.update);
router.delete("/destinations/:id", destinations.remove);

router.get("/agents", agents.list);
router.get("/agents/:id", agents.getOne);
router.post("/agents", uploadAgent.single("image"), agents.create);
router.put("/agents/:id", uploadAgent.single("image"), agents.update);
router.delete("/agents/:id", agents.remove);

router.get("/reports", reports.summary);

router.get("/notifications", misc.list);
router.get("/notifications/unread-count", misc.unreadCount);
router.patch("/notifications/read-all", misc.markAllRead);
router.patch("/notifications/:id/read", misc.markRead);

router.get("/activities", misc.activities);
router.get("/settings", misc.getSettings);
router.put("/settings", misc.updateSettings);

module.exports = router;
