import express, { Express } from "express";
import { config } from "../config/configManager";
import { LoginRoute } from "./LoginRoute";
import type { AuthFlowController } from "../core/auth/AuthFlowController";

export class HttpServer {
  private app: Express;

  constructor(private authFlowController: AuthFlowController) {
    this.app = express();

    // Enable form parsing (urlencoded for HTML forms)
    this.app.use(express.urlencoded({ extended: true }));

    // Register routes
    const loginRoute = new LoginRoute(this.authFlowController);
    this.app.get("/login", (req, res) => loginRoute.handleGet(req, res));
    this.app.post("/login", (req, res) => loginRoute.handlePost(req, res));
  }

  start(): void {
    this.app.listen(config.httpPort, () => {
      console.log(`[HTTP] Login server running at ${config.httpBaseUrl}/login`);
    });
  }
}
