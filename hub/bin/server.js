#!/usr/bin/env node
import { createServer } from "../src/server.js";

const port = Number(process.env.PORT || 8000);
createServer().listen(port, () => {
  console.log(`mjolnir-hub listening on :${port}`);
});
