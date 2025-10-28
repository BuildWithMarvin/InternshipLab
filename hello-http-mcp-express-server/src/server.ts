import express from "express";
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import authRouter from './routes/authRouter.js'
import Database from './services/clientIDcopy.js';

// dotenv.config();

// const app = express();

// app.use(express.json());

// app.use(express.urlencoded({ extended: true }));

// const ClientID = process.env.ClientID;

// app.use('/',authRouter)

// app.get("/blabla", (req: any, res: any) => {
// const param = req.query['ClientID'];
// if (param !== ClientID) {
//     return res.status(400).send("Invalid ClientID");
//   }
// return res.status(200).send("Login successful");
// });

// const PORT = process.env.PORT || 3000;

// app.listen(PORT, () => {
//   console.log(`MCP HTTP server läuft auf http://localhost:${PORT}/mcp`);
// });

const dbInstance = new Database();

const result = await dbInstance.queryClientID(1);

console.log("Client ID:", result);
