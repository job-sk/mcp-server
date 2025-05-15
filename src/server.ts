import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { MCPClient } from "./mcpClient";
import { log } from "console";

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

let mcpClient: MCPClient | null = null;

app.post("/connect", async (req, res) => {
  try {
    const { scriptPath } = req.body;
    mcpClient = new MCPClient();
    await mcpClient.connectToServer(scriptPath);
    res.json({ message: "Connected to MCP server" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/available-tools", async (req, res) => {
  try {
    // await mcpClient.connectToServer(scriptPath);
    res.json({ tools: mcpClient?.listTools() }); // or expose a getter
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/query", async (req, res) => {
  const { prompt } = req.body;
  console.log(prompt,'body')
  try {
    if (!mcpClient) throw new Error("MCP not connected");
    const result = await mcpClient.processQuery(prompt);
    res.json({ response: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ MCP Server running on http://localhost:${PORT}`);
});
