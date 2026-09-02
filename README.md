CARS Playwright Automation

This project contains end-to-end automated tests for the CARS platform using [Playwright](https://playwright.dev/).

Setup Instructions (Local Development)
Prerequisites
Ensure you have the following installed:

- [Node.js (LTS)](https://nodejs.org/)
- [Git](https://git-scm.com/)
- [Visual Studio Code](https://code.visualstudio.com/) (recommended)

Follow these steps to set up and run the project locally in Visual Studio Code:

Step 1: Create an Empty Folder and Open in VS Code

1. On your machine, create an empty directory for the project:
    ```bash
    mkdir cars-playwright-automation
    cd cars-playwright-automation
    ```
2. Open this folder in Visual Studio Code:
    ```bash
    code .
    ```

Step 2: Clone the GitHub Repository
Inside VS Code terminal (or any terminal), clone the repo into the current directory:

```bash
git clone https://github.com/cancapgroupinc/cars-playwright-automation.git .
```

Step 3: Install Project Dependencies

1. First, install the exact dependency versions defined in the package-lock.json:

```bash
npm ci
```

2. Install any additional dependencies that may be missing:

```bash
npm install
```

Step 4: Install VS Code Playwright Extension

1. Open the Extensions panel in VS Code (Ctrl+Shift+X).
2. Search for Playwright Test for VS Code.
3. Click Install.

This extension provides a GUI for running tests and viewing results.

NOTE: IN ORDER TO RUN THE TESTS LOCALLY, YOU NEED credentials.json FILE WHICH HAS THE USER CREDENTIALS FOR ACCOUNTS WE USE FOR AUTOMATION. MAKE SURE TO NOT PUSH IT TO GITHUB BECAUSE OF SECURITY RISKS
