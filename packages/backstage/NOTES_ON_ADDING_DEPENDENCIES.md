# Notes on Adding Dependencies with Containers

🔴 **Con: The Node Modules Ghost Cache:** Because Backstage is a monorepo, both containers share the exact same root layout. If you add a new package dependency on your local machine, you have to execute clean cache flushes and rebuild both containers to align symlinks.

In a standard frontend or backend repository, each project operates as an completely self-contained folder with its own isolated `node_modules` directory. However, because your setup is structured as a **Yarn or PNPM Monorepo Workspace**, the behavior changes significantly under the hood.

Even if you see a `node_modules` folder inside your `packages/app/` and `packages/backend/` subdirectories, **those directories are actually filled with symlinks (shortcuts) pointing back to a single, unified `node_modules` folder located at the root of your entire project.**

This architectural design is what creates the "Ghost Cache" conflict when utilizing the multi-container Docker Compose approach.

## The Symlink Conflict: Host vs. Container

When you use the multi-container configuration described previously, your `docker-compose.yaml` uses **Docker Volumes** to mount your local folder (`.`) into the container at `/app`.

Here is exactly what happens when you add a new dependency package:

```text
[ Your Local Machine (Host) ]
You run: yarn workspace @internal/app add some-new-package
1. The new package is downloaded to your host's root node_modules.
2. A new local symlink is created at packages/app/node_modules/some-new-package -> ../../node_modules/some-new-package

      │
      ▼ (Docker Volume Syncs the Code Files)
      │

[ Inside Container 1: backstage-frontend ]
1. Docker mirrors the text change in packages/app/package.json.
2. Docker mirrors the new symlink file at /app/packages/app/node_modules/some-new-package.
3. CRASH: The symlink inside the container tries to point to /app/node_modules/some-new-package, but that package doesn't exist inside the container's root directory yet because the container's package installation cycle hasn't run.
```

## Why it becomes a "Ghost Cache"

To prevent your local laptop's `node_modules` from overwriting the container's internal linux-compiled binaries, Docker Compose setups utilize an anonymous volume trick (e.g., `- /app/node_modules`).

This creates a hidden, isolated copy of the root `node_modules` folder inside the container's virtual memory layer. Because this memory layer is isolated:

- When you add a dependency locally on your laptop, your local files update instantly.
- The frontend container sees the file changes, but its hidden root `node_modules` memory cache is now out-of-sync with your laptop's root `node_modules`.
- The frontend container will throw a `"Module Not Found"` error, or worse, the backend container will crash because its symlink targets are broken.

To resolve this issue during a multi-container workflow, you cannot simply rely on hot reloading. You must stop your containers, run a manual cache clean command, and execute `docker compose up --build` to force both containers to re-download and re-align their unified monorepo dependency graphs.

## Why the Single-Container Avoids This Completely

This specific synchronization issue is exactly why the **Single-Container Dev Layout** is often favored for local Docker loops:

- There is only **one** instance of the root `node_modules` folder inside the container.
- When you need to install a new package, you simply open a terminal inside that single running container and execute your yarn install command.
- Both the frontend and backend compilation layers update their symlink paths simultaneously in real-time, eliminating any cross-container caching conflicts entirely.

This hassle **only happens when you modify dependencies**—specifically when you add, remove, or change package versions in a `package.json` file.

As long as you are just editing your day-to-day code—like updating a React component in your frontend plugin, tweaking a TypeScript function, or adding a new API endpoint in your backend plugin—the Docker multi-container setup works beautifully. **Hot reloading remains completely intact**, and your code changes will sync and update instantly in the browser without any container restarts or rebuilds.

## The Cheat Code: How to avoid rebuilding even when adding dependencies

If you are using the multi-container (Docker Compose) setup and *do* need to add a new dependency, you can actually bypass the slow container shutdown and rebuild process by using **`docker compose exec`**.

Instead of adding the package on your local laptop terminal, you inject the command directly into the running container environment:

```bash
# Install the package directly inside the live container context
docker compose exec backstage-frontend yarn workspace @internal/app add some-new-package
```

What this does under the hood:

1. It updates the `package.json` inside the container (which instantly reflects back to your laptop via the Docker volume).
2. It downloads the package straight into the container's isolated root `node_modules` cache.
3. The monorepo symlinks align perfectly inside the container in real-time, allowing you to keep coding without ever stopping your containers or running a full manual image rebuild.