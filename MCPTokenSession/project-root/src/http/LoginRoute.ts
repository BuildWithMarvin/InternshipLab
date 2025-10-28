import type { Request, Response } from "express";
import type { AuthFlowController } from "../core/auth/AuthFlowController";

export class LoginRoute {
  constructor(private authFlowController: AuthFlowController) {}

  handleGet(req: Request, res: Response): void {
    const token = req.query.token as string | undefined;

    if (!token) {
      res.status(400).send("Fehlender token.");
      return;
    }

    // Basic HTML form
    res.send(`
      <html>
        <body>
          <h1>VTJ Login</h1>
          <form method="POST" action="/login?token=${token}">
            <label>Username: <input type="text" name="username" required></label><br/>
            <label>Password: <input type="password" name="password" required></label><br/>
            <button type="submit">Login</button>
          </form>
        </body>
      </html>
    `);
  }

  async handlePost(req: Request, res: Response): Promise<void> {
    const token = req.query.token as string | undefined;
    const { username, password } = req.body as { username?: string; password?: string };

    if (!token) {
      res.status(400).send("Fehlender token.");
      return;
    }

    const result = await this.authFlowController.completeLogin(
      token,
      username ?? "",
      password ?? ""
    );

    switch (result.type) {
      case "invalidToken":
        res.status(400).send("Token ungültig oder abgelaufen.");
        return;

      case "loginFailed":
        res.status(401).send(`
          <html>
            <body>
              <p>Login fehlgeschlagen: ${result.reason}</p>
              <a href="/login?token=${token}">Erneut versuchen</a>
            </body>
          </html>
        `);
        return;

      case "success":
        res.send(`
          <html>
            <body>
              <p>Login erfolgreich. Kehren Sie nun zum MCP-Client zurück.</p>
            </body>
          </html>
        `);
        return;
    }
  }
}
