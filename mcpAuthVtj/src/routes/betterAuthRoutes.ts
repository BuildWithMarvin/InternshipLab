// src/routes/betterAuthRoutes.ts - Better Auth OAuth Routes
import { Router, Request, Response } from "express";
import { auth } from "../lib/auth";

const router = Router();

// Better Auth Handler für OAuth-spezifische Routen
router.all("*", async (req: Request, res: Response) => {
  try {
    console.log(`🔐 Better Auth OAuth request: ${req.method} ${req.path}`);
    
    // Convert Express request to Web API Request
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    
    // Create Headers object from Express headers
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach(v => headers.append(key, v));
        } else {
          headers.set(key, String(value));
        }
      }
    });
    
    // Create Web API Request
    const webRequest = new Request(url, {
      method: req.method,
      headers: headers,
      // Only include body for non-GET/HEAD requests
      body: (req.method !== 'GET' && req.method !== 'HEAD' && req.body) 
        ? JSON.stringify(req.body) 
        : undefined,
    });

    // Call Better Auth handler with Web API Request
    const webResponse = await auth.handler(webRequest);
    
    // Set status
    res.status(webResponse.status);
    
    // Set headers from Web API Response
    webResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    // Handle response body
    if (webResponse.body) {
      const contentType = webResponse.headers.get('content-type');
      
      // For JSON responses
      if (contentType?.includes('application/json')) {
        const json = await webResponse.json();
        res.json(json);
      } 
      // For text/html or other text responses
      else if (contentType?.includes('text/')) {
        const text = await webResponse.text();
        res.send(text);
      }
      // For other response types
      else {
        const arrayBuffer = await webResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.send(buffer);
      }
    } else {
      res.end();
    }
    
    console.log(`✅ Better Auth OAuth response: ${webResponse.status}`);
    
  } catch (error) {
    console.error("❌ Better Auth OAuth Handler Error:", error);
    res.status(500).json({ 
      error: "OAuth Error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;