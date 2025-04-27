import { serve } from "https://deno.land/std/http/server.ts";
import { join } from "https://deno.land/std/path/mod.ts";

// Load environment variables (API keys, GitHub token, repo info)
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
const GITHUB_USER = Deno.env.get("GITHUB_USER")!;
const GITHUB_REPO = Deno.env.get("GITHUB_REPO")!;

// Serve HTML page and handle POST requests
const handler = async (req: Request) => {
  const url = new URL(req.url);

  // Serve HTML when accessing the root ("/")
  if (url.pathname === "/") {
    const htmlContent = await getHtmlPage();
    return new Response(htmlContent, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }

  // Handle POST request to generate code and save to GitHub
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const prompt = body?.prompt || "Explain how AI works";  // Default prompt

      // Call to the Gemini API to generate content (code)
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }],
          }],
        }),
      });

      const data = await response.json();  // Parse the JSON response

      // Check if there was an issue with the response
      if (!response.ok) {
        console.error("Error calling Gemini API:", data);
        return new Response("Error generating code: " + data.error.message, { status: 500 });
      }

      const generatedCode = data.choices[0]?.text.trim() || "No code generated.";

      const gitHubResponse = await pushToGitHub(generatedCode, prompt);

      return new Response(
        JSON.stringify({
          generated_code: generatedCode,
          github_response: gitHubResponse,
        }),
        { status: 200 },
      );
    } catch (error) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }

  // Return 404 for any other route
  return new Response("Not Found", { status: 404 });
};

// Function to return HTML page content
async function getHtmlPage() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI Code Generator</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f0f0f0;
            }
            header {
                background-color: #4CAF50;
                color: white;
                padding: 10px 20px;
                text-align: center;
            }
            .container {
                padding: 20px;
                max-width: 600px;
                margin: 0 auto;
                background-color: white;
                box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
            }
            input[type="text"] {
                width: 100%;
                padding: 10px;
                margin: 10px 0;
                border: 1px solid #ccc;
                border-radius: 4px;
            }
            button {
                background-color: #4CAF50;
                color: white;
                padding: 10px 20px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            button:hover {
                background-color: #45a049;
            }
            .result {
                margin-top: 20px;
                padding: 10px;
                background-color: #e9ffe9;
                border: 1px solid #c0f0c0;
                border-radius: 4px;
            }
        </style>
    </head>
    <body>
        <header>
            <h1>AI Code Generator</h1>
        </header>
        <div class="container">
            <h2>Enter Prompt</h2>
            <input type="text" id="prompt" placeholder="Enter prompt...">
            <button onclick="generateCode()">Generate Code</button>
            <div class="result" id="result"></div>
        </div>
        <script>
            async function generateCode() {
                const prompt = document.getElementById("prompt").value;
                const resultDiv = document.getElementById("result");
                try {
                    const response = await fetch("/", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ prompt: prompt }),
                    });
                    const data = await response.json();
                    resultDiv.innerHTML = '<pre>' + data.generated_code + '</pre>';
                } catch (error) {
                    resultDiv.innerHTML = 'Error generating code: ' + error.message;
                }
            }
        </script>
    </body>
    </html>
  `;
}

// Function to push generated code to GitHub
async function pushToGitHub(generatedCode: string, prompt: string) {
  const githubApiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/code-gen-result.js`;
  const fileContent = btoa(generatedCode); // Base64 encode the content

  const response = await fetch(githubApiUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
    },
    body: JSON.stringify({
      message: `Add generated code for prompt: ${prompt}`,
      content: fileContent,
      branch: "main", // or specify your desired branch
    }),
  });

  const data = await response.json();
  return data;
}

// Start the server
serve(handler, { port: 8000 });
