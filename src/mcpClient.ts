import dotenv from "dotenv";
dotenv.config();

import { Anthropic } from "@anthropic-ai/sdk";
import { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";


export class MCPClient {
  private mcp: Client;
  private anthropic: Anthropic;
  private transport: StdioClientTransport | null = null;
  private tools: Tool[] = [];

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    this.anthropic = new Anthropic({ apiKey });
    this.mcp = new Client({ name: "mcp-client-cli", version: "1.0.0" });
  }

  async connectToServer(serverScriptPath: string) {
    const isJs = serverScriptPath.endsWith(".js");
    const isPy = serverScriptPath.endsWith(".py");
    if (!isJs && !isPy) throw new Error("Server script must be a .js or .py file");

    const command = isPy ? (process.platform === "win32" ? "python" : "python3") : process.execPath;

    this.transport = new StdioClientTransport({ command, args: [serverScriptPath] });
    this.mcp.connect(this.transport);

    const toolsResult = await this.mcp.listTools();
    this.tools = toolsResult.tools.map((tool: any) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
    console.log("Connected tools:", this.tools.map((t) => t.name));
  }

  async processQuery(query: string): Promise<string> {
    const messages: MessageParam[] = [{ role: "user", content: query }];
    console.log(messages,"messages");
    
    const response = await this.anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages,
      tools: this.tools,
    });

    const finalText = [];
    for (const content of response.content) {
      if (content.type === "text") {
        finalText.push(content.text);
      } else if (content.type === "tool_use") {
        const input = content.input as { [key: string]: string };
        const result = await this.mcp.callTool({
          name: content.name,
        //   arguments: {
        //     arg1: content.input || {}
        //   }
          arguments: input || {}
        });
        finalText.push(`[Called tool: ${content.name}]`);
        messages.push({ role: "user", content: result.content as string });

        const followUp = await this.anthropic.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          messages,
        });

        if (followUp.content[0].type === "text") {
          finalText.push(followUp.content[0].text);
        }
      }
    }

    return finalText.join("\n");
  }

  async cleanup() {
    await this.mcp.close();
  }
}
