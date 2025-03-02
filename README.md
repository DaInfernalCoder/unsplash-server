# MCP Unsplash

A Model Context Protocol (MCP) server for integrating Unsplash image search and retrieval capabilities with AI assistants.

## Overview

This package provides an MCP server that connects to the Unsplash API, allowing AI assistants to search and retrieve images from Unsplash's vast collection of high-quality, freely-usable images. It also automatically downloads them to the neccessary folder instead of just using links if prompted.

## Features

- **Search Images**: Search for images using keywords
- **Random Images**: Get random images, optionally filtered by topic or orientation
- **Image Details**: Retrieve detailed information about specific images by ID

## Installation

```bash
npm install -g mcp-unsplash
```

## Usage

### Global Installation

If installed globally, you can run the MCP server directly from the command line:

```bash
# Set your Unsplash API key
export UNSPLASH_ACCESS_KEY="your-unsplash-api-key"

# Run the server
mcp-unsplash
```

### In Your MCP Configuration

Add the MCP server to your MCP configuration file:

```json
{
  "mcpServers": {
    "unsplash": {
      "command": "mcp-unsplash",
      "env": {
        "UNSPLASH_ACCESS_KEY": "your-unsplash-api-key"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Local Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the project: `npm run build`
4. Start the server: `npm start`

## Available Tools

### search_images

Search for images on Unsplash by keywords.

```json
{
  "query": "business meeting",
  "page": 1,
  "perPage": 10,
  "orientation": "landscape"
}
```

### get_random_image

Get random images from Unsplash, optionally filtered by criteria.

```json
{
  "query": "office",
  "orientation": "landscape",
  "count": 3
}
```

### get_image_by_id

Get a specific image from Unsplash by its ID.

```json
{
  "id": "abc123"
}
```

## Getting an Unsplash API Key

1. Create an account at [Unsplash](https://unsplash.com/)
2. Register a new application at [Unsplash Developers](https://unsplash.com/developers)
3. Get your API key from the application dashboard

## License

MIT
