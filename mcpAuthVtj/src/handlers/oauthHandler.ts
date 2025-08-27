// src/handlers/oauthHandler.ts
import { Request, Response } from "express";
import { oAuthDiscoveryMetadata } from "better-auth/plugins";
import { auth } from "../lib/auth";

const discoveryHandler = oAuthDiscoveryMetadata(auth);

export const handleOAuthDiscovery = async (req: Request, res: Response) => {
  try {
    console.log('🔍 OAuth Discovery request');
    
    // Convert Express request to Web API Request
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    
    // Convert Express headers to Headers object
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
    
    // Create a Web API Request object
    const webRequest = new Request(url, {
      method: req.method,
      headers: headers,
      // Only include body for non-GET/HEAD requests
      body: (req.method !== 'GET' && req.method !== 'HEAD' && req.body) 
        ? JSON.stringify(req.body) 
        : undefined,
    });
    
    // Call the handler with the Web API Request
    const webResponse = await discoveryHandler(webRequest);
    
    // Convert Web API Response back to Express response
    // Set status
    res.status(webResponse.status);
    
    // Set headers
    webResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    // Send body
    if (webResponse.body) {
      // Stream the response body
      const reader = webResponse.body.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const body = Buffer.concat(chunks);
      res.send(body);
    } else {
      res.end();
    }
  } catch (error) {
    console.error("❌ OAuth Discovery Error:", error);
    res.status(500).json({ error: "OAuth Discovery Error" });
  }
};

// Alternative simpler version if you want to try:
export const handleOAuthDiscoverySimple = async (req: Request, res: Response) => {
  try {
    console.log('🔍 OAuth Discovery request');
    
    // Convert Express headers to Headers object
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
    
    // Convert Express request to Web API Request
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const webRequest = new Request(url, {
      method: req.method,
      headers: headers,
    });
    
    // Call the handler
    const webResponse = await discoveryHandler(webRequest);
    
    // Get the response as text or JSON
    const contentType = webResponse.headers.get('content-type');
    const body = contentType?.includes('application/json') 
      ? await webResponse.json()
      : await webResponse.text();
    
    // Set status and headers
    res.status(webResponse.status);
    webResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    // Send the response
    res.send(body);
  } catch (error) {
    console.error("❌ OAuth Discovery Error:", error);
    res.status(500).json({ error: "OAuth Discovery Error" });
  }
};