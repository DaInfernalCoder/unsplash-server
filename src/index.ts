#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { createApi } from 'unsplash-js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Get API keys from environment variables
const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const SECRET_KEY = process.env.UNSPLASH_SECRET_KEY;

if (!ACCESS_KEY) {
  throw new Error('UNSPLASH_ACCESS_KEY environment variable is required');
}

// Initialize Unsplash API
const unsplash = createApi({
  accessKey: ACCESS_KEY,
  fetch: fetch as any
});

class UnsplashServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'unsplash-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_images',
          description: 'Search for images on Unsplash by keywords',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (keywords for image search)',
              },
              page: {
                type: 'number',
                description: 'Page number for pagination (default: 1)',
              },
              perPage: {
                type: 'number',
                description: 'Number of images per page (default: 10, max: 30)',
              },
              orientation: {
                type: 'string',
                enum: ['landscape', 'portrait', 'squarish'],
                description: 'Filter by image orientation',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'download_image',
          description: 'Download an image from Unsplash by URL or ID and save it to the local filesystem',
          inputSchema: {
            type: 'object',
            properties: {
              imageSource: {
                type: 'string',
                description: 'Either a direct image URL or an Unsplash image ID',
              },
              sourceType: {
                type: 'string',
                enum: ['url', 'id'],
                description: 'Type of source provided (url or id)',
              },
              destinationPath: {
                type: 'string',
                description: 'Path where the image should be saved (including filename)',
              },
              quality: {
                type: 'string',
                enum: ['raw', 'full', 'regular', 'small', 'thumb'],
                description: 'Image quality to download (defaults to regular)',
              },
            },
            required: ['imageSource', 'sourceType', 'destinationPath'],
          },
        },
        {
          name: 'get_random_image',
          description: 'Get a random image from Unsplash, optionally filtered by criteria',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Optional topic or search term',
              },
              orientation: {
                type: 'string',
                enum: ['landscape', 'portrait', 'squarish'],
                description: 'Filter by image orientation',
              },
              count: {
                type: 'number',
                description: 'Number of images to return (default: 1, max: 30)',
              },
            },
          },
        },
        {
          name: 'get_image_by_id',
          description: 'Get a specific image from Unsplash by its ID',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Unsplash image ID',
              },
            },
            required: ['id'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'search_images':
          return this.handleSearchImages(request.params.arguments);
        case 'get_random_image':
          return this.handleGetRandomImage(request.params.arguments);
        case 'get_image_by_id':
          return this.handleGetImageById(request.params.arguments);
        case 'download_image':
          return this.handleDownloadImage(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async handleSearchImages(args: any) {
    try {
      const { query, page = 1, perPage = 10, orientation } = args;
      
      if (!query || typeof query !== 'string') {
        return {
          content: [
            {
              type: 'text',
              text: 'Invalid query. Please provide a search term.',
            },
          ],
          isError: true,
        };
      }

      const result = await unsplash.search.getPhotos({
        query,
        page,
        perPage: Math.min(perPage, 30),
        orientation,
      });

      if (result.errors) {
        return {
          content: [
            {
              type: 'text',
              text: `Unsplash API error: ${result.errors.join(', ')}`,
            },
          ],
          isError: true,
        };
      }

      const images = result.response.results.map(photo => ({
        id: photo.id,
        description: photo.description || photo.alt_description || 'No description',
        width: photo.width,
        height: photo.height,
        urls: photo.urls,
        user: {
          name: photo.user.name,
          username: photo.user.username,
          link: photo.user.links.html,
        },
        links: photo.links,
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              total: result.response.total,
              total_pages: result.response.total_pages,
              images
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Error in search_images:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error searching images: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGetRandomImage(args: any) {
    try {
      const { query, orientation, count = 1 } = args;
      
      const result = await unsplash.photos.getRandom({
        query,
        orientation,
        count: Math.min(count, 30),
      });

      if (result.errors) {
        return {
          content: [
            {
              type: 'text',
              text: `Unsplash API error: ${result.errors.join(', ')}`,
            },
          ],
          isError: true,
        };
      }

      const formatPhoto = (photo: any) => ({
        id: photo.id,
        description: photo.description || photo.alt_description || 'No description',
        width: photo.width,
        height: photo.height,
        urls: photo.urls,
        user: {
          name: photo.user.name,
          username: photo.user.username,
          link: photo.user.links.html,
        },
        links: photo.links,
      });

      const images = Array.isArray(result.response) 
        ? result.response.map(formatPhoto)
        : [formatPhoto(result.response)];

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ images }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Error in get_random_image:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error getting random image: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGetImageById(args: any) {
    try {
      const { id } = args;
      
      if (!id || typeof id !== 'string') {
        return {
          content: [
            {
              type: 'text',
              text: 'Invalid ID. Please provide a valid Unsplash image ID.',
            },
          ],
          isError: true,
        };
      }

      const result = await unsplash.photos.get({ photoId: id });

      if (result.errors) {
        return {
          content: [
            {
              type: 'text',
              text: `Unsplash API error: ${result.errors.join(', ')}`,
            },
          ],
          isError: true,
        };
      }

      const photo = result.response;
      const image = {
        id: photo.id,
        description: photo.description || photo.alt_description || 'No description',
        width: photo.width,
        height: photo.height,
        urls: photo.urls,
        user: {
          name: photo.user.name,
          username: photo.user.username,
          link: photo.user.links.html,
        },
        links: photo.links,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ image }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Error in get_image_by_id:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error getting image by ID: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleDownloadImage(args: any) {
    try {
      const { imageSource, sourceType, destinationPath, quality = 'regular' } = args;
      
      if (!imageSource || !sourceType || !destinationPath) {
        return {
          content: [
            {
              type: 'text',
              text: 'Missing required parameters. Please provide imageSource, sourceType, and destinationPath.',
            },
          ],
          isError: true,
        };
      }

      if (sourceType !== 'url' && sourceType !== 'id') {
        return {
          content: [
            {
              type: 'text',
              text: 'Invalid sourceType. Please provide either "url" or "id".',
            },
          ],
          isError: true,
        };
      }

      // Ensure the directory exists
      const dir = path.dirname(destinationPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      let imageUrl: string;
      
      // Get the image URL based on the source type
      if (sourceType === 'id') {
        // Get image details by ID
        const result = await unsplash.photos.get({ photoId: imageSource });
        
        if (result.errors) {
          return {
            content: [
              {
                type: 'text',
                text: `Unsplash API error: ${result.errors.join(', ')}`,
              },
            ],
            isError: true,
          };
        }
        
        // Use the requested quality or default to regular
        // Handle quality type-safely
        const urls = result.response.urls;
        switch(quality) {
          case 'raw':
            imageUrl = urls.raw;
            break;
          case 'full':
            imageUrl = urls.full;
            break;
          case 'small':
            imageUrl = urls.small;
            break;
          case 'thumb':
            imageUrl = urls.thumb;
            break;
          case 'regular':
          default:
            imageUrl = urls.regular;
            break;
        }
        
        // Track a download with the Unsplash API (required by their terms)
        await unsplash.photos.trackDownload({
          downloadLocation: result.response.links.download_location,
        });
      } else {
        // Use the direct URL
        imageUrl = imageSource;
      }

      // Download the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to download image: ${response.status} ${response.statusText}`,
            },
          ],
          isError: true,
        };
      }

      // Convert the response to a buffer
      const buffer = await response.buffer();

      // Write the image to the file system
      await promisify(fs.writeFile)(destinationPath, buffer);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Image successfully downloaded to ${destinationPath}`,
              filePath: destinationPath,
              fileSize: buffer.length,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Error in download_image:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error downloading image: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Unsplash MCP server running on stdio');
  }
}

const server = new UnsplashServer();
server.run().catch(console.error);
