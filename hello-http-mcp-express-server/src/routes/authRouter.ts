
import express from "express";
import { AuthController } from "../controller/authController.js";


const router = express.Router();
const authController = new AuthController();

router.get("/auth", (req, res, next) => {
  authController.getAuth(req, res, next);
});

export default router;
