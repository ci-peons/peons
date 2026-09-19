#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.ts";
const server = createServer({ root: process.env.PEONS_ROOT ?? process.cwd() });
await server.connect(new StdioServerTransport());
