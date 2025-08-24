#!/bin/bash
# Launch script for Obsidian MCP Server

# Set up PATH for npm
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

cd ~/Development/obsidian-mcp-server

# Set the vault path (already defaults to the right location)
export OBSIDIAN_VAULT_PATH="${OBSIDIAN_VAULT_PATH:-~/Obsidian/Brain}"

# Start the server
npm start