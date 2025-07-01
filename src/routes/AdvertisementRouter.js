// routes/AdvertisementRoutes.js
const express = require("express");
const router = express.Router();
const AdvertisementController = require("../controllers/AdvertisementController");

// APIs
router.post("/create-ad", AdvertisementController.createAd);
router.post("/approve-ad/:id", AdvertisementController.approveAd);
router.post("/:id/reject", AdvertisementController.rejectAd);
router.get("/approved-ads", AdvertisementController.getApprovedAds);
router.get("/pending-ads", AdvertisementController.getPendingAds);
router.get("/my-ads", AdvertisementController.getMyAds);
router.get('/has-active-ad/:userId', AdvertisementController.checkHasActiveAd);
router.get('/active-ads', AdvertisementController.getActiveAdvertisements);
router.get("/count", AdvertisementController.getAdCountByPosition);
router.delete("/delete-ad/:id", AdvertisementController.deleteAd);
router.put("/update-ad/:id", AdvertisementController.updateAd);


module.exports = router;
