# Claude Infrastructure

Core infrastructure and shared libraries for Claude Code skills ecosystem.

## Components

### Obsidian MCP Server
Model Context Protocol server providing Claude access to Obsidian vaults.

**Location**: `obsidian-mcp-server/`
**Purpose**: Enable Claude to read, write, and search Obsidian notes
**Installation**:
```bash
cd obsidian-mcp-server
npm install && npm run build
```

### Granola Obsidian Sync
Library for integrating Granola meeting transcriptions with Obsidian.

**Location**: `granola-obsidian-sync/`
**Purpose**: Sync meeting transcriptions to daily notes
**Features**:
- Reverse-engineered Granola API integration
- Automatic daily note creation and updating
- Meeting metadata extraction

## Installation

### Quick Setup
```bash
git clone https://github.com/unsensible-com/claude-infrastructure.git
cd claude-infrastructure
./install.sh
```

### Manual Setup

1. **Obsidian MCP Server**:
   ```bash
   cd obsidian-mcp-server
   npm install
   npm run build
   ```

2. **Python Libraries**:
   ```bash
   cd granola-obsidian-sync
   pip install -r requirements.txt
   ```

## Configuration

### Obsidian MCP Server

Add to your Claude MCP configuration:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["/path/to/claude-infrastructure/obsidian-mcp-server/build/index.js"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/path/to/your/vault"
      }
    }
  }
}
```

### Environment Variables

Create `.env` file:
```bash
# Obsidian Configuration
OBSIDIAN_VAULT_PATH="/Users/username/Obsidian/Vault"

# Granola Integration (if used)
GRANOLA_API_BASE_URL="https://api.granola.com"
```

## Usage

### In Claude Skills

Skills can use these infrastructure components:

```python
# In a skill's main.py
from claude_infrastructure.granola import GranolaSync
from claude_infrastructure.obsidian import ObsidianClient

# Use Granola sync
granola = GranolaSync()
meetings = granola.get_today_meetings()

# Use Obsidian (via MCP)
# This happens automatically through Claude's MCP connection
```

### Direct Usage

```bash
# Test MCP server
cd obsidian-mcp-server
npm test

# Test Granola sync
cd granola-obsidian-sync
python -m granola_sync --test
```

## Development

### Building MCP Server

```bash
cd obsidian-mcp-server
npm run build
npm run watch  # For development
```

### Testing

```bash
# Test all components
./test.sh

# Test specific component
cd obsidian-mcp-server && npm test
cd granola-obsidian-sync && python -m pytest
```

## Architecture

```
claude-infrastructure/
├── obsidian-mcp-server/     # MCP server for Obsidian integration
│   ├── src/                 # TypeScript source
│   ├── build/              # Compiled JavaScript
│   └── package.json        # Node.js dependencies
├── granola-obsidian-sync/  # Granola integration library
│   ├── granola_sync/       # Python package
│   ├── tests/              # Test suite
│   └── requirements.txt    # Python dependencies
├── shared/                 # Shared utilities and libraries
│   ├── python/            # Python shared code
│   └── typescript/        # TypeScript shared code
└── scripts/               # Installation and maintenance scripts
    ├── install.sh         # Main installation script
    ├── test.sh           # Run all tests
    └── update.sh         # Update all components
```

## Dependencies

### System Requirements
- Node.js 16+ (for MCP server)
- Python 3.8+ (for Python libraries)
- Git (for version control)

### Runtime Dependencies
- Obsidian (for vault access)
- Claude Code CLI (for MCP integration)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run the test suite
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

- **Issues**: Report infrastructure issues here
- **Skills**: For skill-specific issues, use individual skill repositories
- **Discussion**: Use claude-setup repository for general discussion