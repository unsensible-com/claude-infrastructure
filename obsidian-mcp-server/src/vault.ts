import { promises as fs } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { LocalIndex } from 'vectra';
import { pipeline } from '@xenova/transformers';
import chokidar from 'chokidar';

interface SearchResult {
  path: string;
  title: string;
  content: string;
  score: number;
  type: 'daily' | 'project' | 'reference' | 'transcript' | 'other';
}

interface DailyContext {
  date: string;
  dailyNote?: string;
  transcript?: string;
  recentProjects?: Array<{path: string; title: string; modified: Date}>;
  weeklyGoals?: string;
}

export class ObsidianVault {
  private vaultPath: string;
  private index: LocalIndex;
  private embedder: any;
  private fileWatcher?: chokidar.FSWatcher;
  private fileMetadata: Map<string, {title: string; type: string}> = new Map();

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
    this.index = new LocalIndex(path.join(vaultPath, '.mcp-index'));
  }

  async initialize() {
    // Initialize embedder
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    
    // Create or load index
    if (!(await this.index.isIndexCreated())) {
      await this.index.createIndex();
    }
    
    // Set up file watcher first
    this.setupFileWatcher();
    
    // Index vault asynchronously to avoid timeout
    this.indexVault().catch(error => {
      console.error('Error during initial indexing:', error);
    });
  }

  private async indexVault() {
    console.error('Starting vault indexing...');
    const files = await this.getAllMarkdownFiles();
    
    // Process files in batches to avoid overwhelming the system
    const batchSize = 10;
    let indexed = 0;
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await Promise.all(batch.map(file => this.indexFile(file)));
      
      indexed += batch.length;
      if (indexed % 100 === 0) {
        console.error(`Indexed ${indexed}/${files.length} files...`);
      }
    }
    
    console.error(`Vault indexing complete: ${files.length} files`);
  }

  private async getAllMarkdownFiles(dir = this.vaultPath): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          return this.getAllMarkdownFiles(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          return [fullPath];
        }
        return [];
      })
    );
    
    return files.flat();
  }

  private async indexFile(filePath: string) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const { data, content: bodyContent } = matter(content);
      
      const relativePath = path.relative(this.vaultPath, filePath);
      const type = this.getFileType(relativePath);
      const title = data.title || path.basename(filePath, '.md');
      
      // Store metadata
      this.fileMetadata.set(relativePath, { title, type });
      
      // Create embedding
      const text = `${title} ${bodyContent}`.slice(0, 1000); // Limit context
      const output = await this.embedder(text, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data) as number[];
      
      // Add to index
      await this.index.upsertItem({
        id: relativePath,
        vector: embedding,
        metadata: { path: relativePath, title, type },
      });
    } catch (error) {
      console.error(`Error indexing ${filePath}:`, error);
    }
  }

  private getFileType(relativePath: string): string {
    if (relativePath.includes('Periodic Notes')) return 'daily';
    if (relativePath.includes('Projects')) return 'project';
    if (relativePath.includes('Reference')) return 'reference';
    if (relativePath.includes('Transcripts/Limitless')) return 'transcript';
    return 'other';
  }

  private setupFileWatcher() {
    this.fileWatcher = chokidar.watch('**/*.md', {
      cwd: this.vaultPath,
      ignored: /(^|[\/\\])\../,
      persistent: true,
    });

    this.fileWatcher
      .on('add', (filePath) => this.indexFile(path.join(this.vaultPath, filePath)))
      .on('change', (filePath) => this.indexFile(path.join(this.vaultPath, filePath)))
      .on('unlink', async (filePath) => {
        await this.index.deleteItem(filePath);
        this.fileMetadata.delete(filePath);
      });
  }

  async search(query: string, type: string = 'all', limit: number = 10): Promise<SearchResult[]> {
    // Create query embedding
    const output = await this.embedder(query, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(output.data) as number[];
    
    // Search index - Vectra expects: vector, query string, topK
    const results = await this.index.queryItems(queryVector, query, limit * 2);
    
    // Filter by type if specified
    const filtered = type === 'all' 
      ? results 
      : results.filter(r => {
          const metadataPath = r.item.metadata?.path as string;
          return this.fileMetadata.get(metadataPath)?.type === type;
        });
    
    // Read content and format results
    const searchResults: SearchResult[] = [];
    for (const result of filtered.slice(0, limit)) {
      const metadataPath = result.item.metadata?.path as string;
      const metadataTitle = result.item.metadata?.title as string;
      const metadataType = result.item.metadata?.type as string;
      const filePath = path.join(this.vaultPath, metadataPath);
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const { content: bodyContent } = matter(content);
        
        searchResults.push({
          path: metadataPath,
          title: metadataTitle,
          content: bodyContent.slice(0, 500) + '...',
          score: result.score,
          type: metadataType as 'daily' | 'project' | 'reference' | 'transcript' | 'other',
        });
      } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
      }
    }
    
    return searchResults;
  }

  async getDailyContext(date?: string, options?: {includeTranscripts?: boolean; includeProjects?: boolean}): Promise<DailyContext> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const context: DailyContext = { date: targetDate };
    
    // Get daily note
    const dailyNotePath = await this.findDailyNote(targetDate);
    if (dailyNotePath) {
      context.dailyNote = await this.readNote(dailyNotePath);
    }
    
    // Get transcript
    if (options?.includeTranscripts !== false) {
      const transcriptPath = `Transcripts/Limitless/Lifelogs/${targetDate}.md`;
      try {
        context.transcript = await this.readNote(transcriptPath);
      } catch (error) {
        // No transcript for this day
      }
    }
    
    // Get recent projects
    if (options?.includeProjects !== false) {
      const projectFiles = await this.getRecentFiles('Projects', 7);
      context.recentProjects = projectFiles;
    }
    
    return context;
  }

  async readNote(relativePath: string): Promise<string> {
    const fullPath = path.join(this.vaultPath, relativePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    const { content: bodyContent } = matter(content);
    return bodyContent;
  }

  private async findDailyNote(date: string): Promise<string | null> {
    // Parse date
    const [year, month, day] = date.split('-');
    const targetDate = new Date(date);
    const weekday = targetDate.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Search for daily note in expected locations
    const patterns = [
      `Periodic Notes/${year}/*/${day}-${weekday}.md`,
      `Periodic Notes/${year}/**/${day}-${weekday}.md`,
    ];
    
    for (const pattern of patterns) {
      const files = await this.getAllMarkdownFiles();
      const match = files.find(f => {
        const relative = path.relative(this.vaultPath, f);
        return relative.includes(`${day}-${weekday}.md`);
      });
      
      if (match) {
        return path.relative(this.vaultPath, match);
      }
    }
    
    return null;
  }

  private async getRecentFiles(folder: string, days: number): Promise<Array<{path: string; title: string; modified: Date}>> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const folderPath = path.join(this.vaultPath, folder);
    const files = await this.getAllMarkdownFiles(folderPath);
    
    const fileStats = await Promise.all(
      files.map(async (file) => {
        const stats = await fs.stat(file);
        const relativePath = path.relative(this.vaultPath, file);
        const metadata = this.fileMetadata.get(relativePath);
        
        return {
          path: relativePath,
          title: metadata?.title || path.basename(file, '.md'),
          modified: stats.mtime,
        };
      })
    );
    
    return fileStats
      .filter(f => f.modified > cutoff)
      .sort((a, b) => b.modified.getTime() - a.modified.getTime());
  }

  async close() {
    if (this.fileWatcher) {
      await this.fileWatcher.close();
    }
  }
}