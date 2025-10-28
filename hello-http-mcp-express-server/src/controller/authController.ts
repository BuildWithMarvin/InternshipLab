import express from 'express'
import { NextFunction } from 'express';
import { getAuth } from "../services/auth.js";

export class AuthController {
  async getAuth(req: express.Request, res: express.Response, next: NextFunction) {
    try {
      const result = await getAuth();
      res.json(result);
      res.status(200)
      console.log("Auth successful", result);
    } catch (error) {
      next(error);
    }
  }
}