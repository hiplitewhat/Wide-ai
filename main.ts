import { serve } from "https://deno.land/std/http/server.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";
import { join } from "https://deno.land/std/path/mod.ts";

// Load environment variables (API keys, GitHub token, repo info)
const { GEMINI_API_KEY, GITHUB_TOKEN, GITHUB_USER, GITHUB_REPO } = config();

// Serve HTML page and handle POST requests
const handler = async (req: Request) => {
  const url = new URL(req.url);
  
  // Serve HTML when accessing the root ("/")
  if (url.pathname === "/") {
    const htmlContent = await getHtmlPage();
    return new Response(htmlContent, { status: 200, headers: { "Content-Type": "text/html" } });
  }
  
  // Handle POST request to generate code and save to GitHub
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const prompt = body?.prompt || "Write a function to reverse a string in JavaScript.";

      // Call to the Gemini API (replace with actual API URL)
      const response = await fetch("https://gemini-api.example.com/v1/code-gen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GEMINI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gemini-code-model",
          prompt: prompt,
          max_tokens: 200,
        }),
      });

      const data = await response.json();
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
                border: 1px solid #4CAF50;
            }
        </style>
    </head>
    <body>
        <header>
            <h1>AI Code Generator</h1>
        </header>

        <div class="container">
            <h2>Enter a Code Prompt</h2>
            <form id="code-form">
                <label for="prompt">Prompt:</label>
                <input type="text" id="prompt" name="prompt" placeholder="e.g., Write a Python function to check if a number is prime" required>
                <button type="submit">Generate Code</button>
            </form>

            <div id="result" class="result" style="display: none;">
                <h3>Generated Code:</h3>
                <pre id="generated-code"></pre>
                <h3>GitHub Link:</h3>
                <p id="github-link"></p>
            </div>
        </div>

        <script>
            document.getElementById('code-form').addEventListener('submit', async (event) => {
                event.preventDefault();
                const prompt = document.getElementById('prompt').value;

                // Send the prompt to the Deno server
                const response = await fetch('/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ prompt: prompt }),
                });

                const data = await response.json();

                // Show the generated code and GitHub link
                if (response.ok) {
                    document.getElementById('generated-code').textContent = data.generated_code;
                    document.getElementById('github-link').textContent = data.github_response;
                    document.getElementById('result').style.display = 'block';
                } else {
                    document.getElementById('generated-code').textContent = 'Error generating code: ' + data.error;
                    document.getElementById('github-link').textContent = '';
                    document.getElementById('result').style.display = 'block';
                }
            });
        </script>
    </body>
    </html>
  `;
}

// Function to save the generated code to GitHub
async function pushToGitHub(code: string, prompt: string) {
  try {
    const githubApiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/generated_code/${prompt.replace(/\s+/g, '_')}.js`;

    const content = btoa(code); // Base64 encode the code
    const message = `Add generated code for prompt: ${prompt}`;

    const response = await fetch(githubApiUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message,
        content: content, // The base64-encoded code
        branch: "main",    // Specify the branch to commit to
      }),
    });

    const data = await response.json();
    if (response.ok) {
      return `Successfully pushed code to GitHub: ${data.content?.html_url}`;
    } else {
      return `Error pushing to GitHub: ${data.message}`;
    }
  } catch (error) {
    return `Error pushing to GitHub: ${error.message}`;
  }
}

// Start the HTTP server
console.log("Server running on http://localhost:8000");
serve(handler);
