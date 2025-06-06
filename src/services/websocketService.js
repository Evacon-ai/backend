const WebSocket = require("ws");

class WebSocketService {
  constructor() {
    this.clients = new Map();
  }

  initialize(server) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on("connection", (ws) => {
      console.log("New WebSocket connection");

      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message);
          if (data.type === "subscribe") {
            if (data.isAdmin) {
              // Admin subscribes to all updates
              this.clients.set(ws, "*");
              console.log("Admin subscribed to all organizations");
            } else if (data.organizationId) {
              // Regular user subscribes to specific organization
              this.clients.set(ws, data.organizationId);
              console.log(
                `Client subscribed to organization: ${data.organizationId}`
              );
            }
          }
        } catch (error) {
          console.error("WebSocket message error:", error);
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
        console.log("Client disconnected");
      });
    });
  }

  broadcastToOrganization(organizationId, data) {
    console.log(
      "[TESTING]: broadcastToOrganization called for org:",
      organizationId
    );
    console.log("[TESTING]: Connected clients:", this.clients.size);

    this.clients.forEach((clientOrgId, client) => {
      if (
        (clientOrgId === "*" || clientOrgId === organizationId) &&
        client.readyState === WebSocket.OPEN
      ) {
        console.log("[TESTING]: Sending to client with orgId:", clientOrgId);
        client.send(JSON.stringify(data));
      }
    });

    console.log("[TESTING]: Broadcast complete");
  }
}

const wsService = new WebSocketService();
module.exports = wsService;
