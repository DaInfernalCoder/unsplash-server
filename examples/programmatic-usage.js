#!/usr/bin/env node
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { stdin as input, stdout as output } from 'process';

/**
 * Example showing how to use mcp-unsplash programmatically
 * 
 * This demonstrates starting the MCP server as a child process
 * and communicating with it via JSON-RPC
 */

// API key should be set as an environment variable
const UNSPLASH_API_KEY = process.env.UNSPLASH_ACCESS_KEY || 'your-api-key-here';

// Start the MCP server process
const serverProcess = spawn('node', ['../build/index.js'], {
  env: {
    ...process.env,
    UNSPLASH_ACCESS_KEY: UNSPLASH_API_KEY
  }
});

// Helper for sending JSON-RPC requests
let requestId = 1;
function sendRequest(method, params) {
  const request = {
    jsonrpc: '2.0',
    id: requestId++,
    method,
    params
  };
  
  const requestString = JSON.stringify(request) + '\n';
  serverProcess.stdin.write(requestString);
}

// Parse responses from the server
serverProcess.stdout.on('data', (data) => {
  const responseString = data.toString();
  try {
    const response = JSON.parse(responseString);
    console.log('Received response:');
    console.log(JSON.stringify(response, null, 2));
    
    // If we're getting the result of a tool call with images, display URLs
    if (
      response.result && 
      response.result.content && 
      response.result.content[0] && 
      response.result.content[0].text
    ) {
      try {
        const content = JSON.parse(response.result.content[0].text);
        if (content.images) {
          console.log('\nImage URLs:');
          content.images.forEach((img, i) => {
            console.log(`Image ${i+1}: ${img.urls.regular}`);
            console.log(`By: ${img.user.name} (${img.user.link})`);
            console.log('---');
          });
        } else if (content.image) {
          console.log('\nImage URL:');
          console.log(`URL: ${content.image.urls.regular}`);
          console.log(`By: ${content.image.user.name} (${content.image.user.link})`);
        }
      } catch (e) {
        // Not parseable JSON or not in expected format
      }
    }
  } catch (e) {
    console.log('Received non-JSON response:', responseString);
  }
});

// Handle errors
serverProcess.stderr.on('data', (data) => {
  console.error(`Server error: ${data}`);
});

// Interactive CLI
const rl = createInterface({ input, output });

// First, list available tools
console.log('Listing available tools...');
sendRequest('list_tools', {});

// Simple CLI menu
function showMenu() {
  console.log('\n--- MCP Unsplash Demo ---');
  console.log('1. Search for images');
  console.log('2. Get random images');
  console.log('3. Get image by ID');
  console.log('4. Exit');
  rl.question('Select an option: ', (answer) => {
    switch(answer) {
      case '1':
        searchImages();
        break;
      case '2':
        getRandomImages();
        break;
      case '3': 
        getImageById();
        break;
      case '4':
        console.log('Exiting...');
        serverProcess.kill();
        rl.close();
        process.exit(0);
        break;
      default:
        console.log('Invalid option');
        showMenu();
    }
  });
}

function searchImages() {
  rl.question('Enter search query: ', (query) => {
    rl.question('Number of results (max 30): ', (perPage) => {
      rl.question('Orientation (landscape, portrait, squarish, or leave empty): ', (orientation) => {
        const params = {
          name: 'search_images',
          arguments: {
            query: query,
            perPage: parseInt(perPage) || 10
          }
        };
        
        if (orientation) {
          params.arguments.orientation = orientation;
        }
        
        sendRequest('call_tool', params);
        
        // Return to menu after a delay
        setTimeout(showMenu, 500);
      });
    });
  });
}

function getRandomImages() {
  rl.question('Enter topic (optional): ', (query) => {
    rl.question('Number of images (max 30): ', (count) => {
      rl.question('Orientation (landscape, portrait, squarish, or leave empty): ', (orientation) => {
        const params = {
          name: 'get_random_image',
          arguments: {
            count: parseInt(count) || 1
          }
        };
        
        if (query) {
          params.arguments.query = query;
        }
        
        if (orientation) {
          params.arguments.orientation = orientation;
        }
        
        sendRequest('call_tool', params);
        
        // Return to menu after a delay
        setTimeout(showMenu, 500);
      });
    });
  });
}

function getImageById() {
  rl.question('Enter Unsplash image ID: ', (id) => {
    sendRequest('call_tool', {
      name: 'get_image_by_id',
      arguments: {
        id: id
      }
    });
    
    // Return to menu after a delay
    setTimeout(showMenu, 500);
  });
}

// Start the interactive menu after a short delay
setTimeout(showMenu, 1000);
