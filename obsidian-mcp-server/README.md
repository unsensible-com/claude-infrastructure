# Obsidian MCP Server

This MCP (Model Context Protocol) server provides Claude with direct access to your Obsidian vault, enabling semantic search and context retrieval across all your notes, transcripts, and projects.

## Features

- **Semantic Search**: Search across your entire vault using natural language queries
- **Daily Context**: Get comprehensive daily context including transcripts, notes, and project activity
- **Real-time Updates**: Automatically indexes new and modified files
- **Type Filtering**: Search specific content types (daily notes, projects, references, transcripts)
- **Vector Embeddings**: Uses local embeddings for privacy-preserving semantic search

## Installation

1. Navigate to the MCP directory:
```bash
cd ~/Obsidian/Brain/obsidian-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the TypeScript files:
```bash
npm run build
```

## Configuration

Add this to your Claude Desktop configuration file (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "obsidian-vault": {
      "command": "node",
      "args": ["~/Claude/Development/obsidian-mcp-server/dist/index.js"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "~/Obsidian/Brain"
      }
    }
  }
}
```

## Usage in Claude

Once configured, Claude will have access to these tools:

### 1. Search Vault
```
Search for: "Transcelestial interview"
Type: projects
Limit: 5
```

### 2. Get Daily Context
```
Get context for: 2025-08-15
Include transcripts: true
Include projects: true
```

### 3. Read Note
```
Read: Projects/Podcasts/Transcelestial - Mohammed Danesh/Transcelestial Danesh Interview Prep.md
```

## How It Works

1. **Indexing**: On startup, the server indexes all markdown files in your vault
2. **Embeddings**: Creates vector embeddings using a local model (all-MiniLM-L6-v2)
3. **Search**: Uses cosine similarity to find relevant content
4. **Updates**: Watches for file changes and updates the index in real-time

## Privacy

- All processing happens locally on your machine
- No data is sent to external services
- Embeddings are stored in `.mcp-index` within your vault

## Troubleshooting

1. **Check logs**: Claude Desktop logs are in `~/Library/Logs/Claude/`
2. **Verify path**: Ensure the vault path in config matches your actual vault location
3. **Restart Claude**: After config changes, restart Claude Desktop

## Development

To run in development mode with hot reload:
```bash
npm run dev
```