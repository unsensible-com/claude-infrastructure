import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { ObsidianVault } from './vault.js';
import { z } from 'zod';

// Get vault path from environment or default
const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || '~/Obsidian/Brain';

// Initialize vault manager
const vault = new ObsidianVault(VAULT_PATH);

// Create MCP server
const server = new Server(
  {
    name: 'obsidian-vault',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define search parameters schema
const SearchArgsSchema = z.object({
  query: z.string().describe('Search query for finding relevant content'),
  type: z.enum(['all', 'daily', 'projects', 'reference', 'transcripts']).optional().default('all'),
  limit: z.number().optional().default(10),
});

const GetContextArgsSchema = z.object({
  date: z.string().optional().describe('Date in YYYY-MM-DD format, defaults to today'),
  includeTranscripts: z.boolean().optional().default(true),
  includeProjects: z.boolean().optional().default(true),
});

const ReadNoteArgsSchema = z.object({
  path: z.string().describe('Path to the note relative to vault root'),
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_vault',
        description: 'Search across Obsidian vault for relevant content using semantic search',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for finding relevant content',
            },
            type: {
              type: 'string',
              enum: ['all', 'daily', 'projects', 'reference', 'transcripts'],
              description: 'Type of content to search',
              default: 'all',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return',
              default: 10,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_daily_context',
        description: 'Get comprehensive daily context including transcripts, active projects, and daily notes',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Date in YYYY-MM-DD format, defaults to today',
            },
            includeTranscripts: {
              type: 'boolean',
              description: 'Include Limitless transcripts',
              default: true,
            },
            includeProjects: {
              type: 'boolean',
              description: 'Include recent project activity',
              default: true,
            },
          },
        },
      },
      {
        name: 'read_note',
        description: 'Read a specific note from the vault',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the note relative to vault root',
            },
          },
          required: ['path'],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (!request.params.name) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'Tool name is required'
    );
  }

  try {
    switch (request.params.name) {
      case 'search_vault': {
        const args = SearchArgsSchema.parse(request.params.arguments);
        const results = await vault.search(args.query, args.type, args.limit);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'get_daily_context': {
        const args = GetContextArgsSchema.parse(request.params.arguments);
        const context = await vault.getDailyContext(args.date, {
          includeTranscripts: args.includeTranscripts,
          includeProjects: args.includeProjects,
        });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(context, null, 2),
            },
          ],
        };
      }

      case 'read_note': {
        const args = ReadNoteArgsSchema.parse(request.params.arguments);
        const content = await vault.readNote(args.path);
        
        return {
          content: [
            {
              type: 'text',
              text: content,
            },
          ],
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${error.message}`
      );
    }
    throw error;
  }
});

// Start the server
async function main() {
  console.error('Starting Obsidian MCP Server...');
  console.error(`Vault path: ${VAULT_PATH}`);
  
  // Initialize vault
  await vault.initialize();
  
  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('Obsidian MCP Server running');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});