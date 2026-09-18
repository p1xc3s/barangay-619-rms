import { Router } from "express";
import { ResidentController } from "./resident.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authorizeRole } from "../../middlewares/role.middleware.js";

const router = Router();

//All resident routes require authentication
router.use(authenticate);

//Add resident
router.post(
    "/",
    authorizeRole("Admin", "Staff"),
    ResidentController.createResident
);

//Check duplicate resident
router.post(
    "/check-duplicate",
    authorizeRole("Admin", "Staff"),
    ResidentController.checkDuplicate
);

//Get all residents
router.get(
    "/",
    authorizeRole("Admin", "Staff"),
    ResidentController.getAllResidents
);

//Search residents
router.get(
    "/search",
    authorizeRole("Admin", "Staff"),
    ResidentController.searchResidents
);

//Get resident by ID
router.get(
    "/:id",
    authorizeRole("Admin", "Staff"),
    ResidentController.getResidentById
);

//Update resident
router.put(
    "/:id",
    authorizeRole("Admin", "Staff"),
    ResidentController.updateResident
);

export default router;