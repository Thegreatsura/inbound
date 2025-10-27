# Inbound shadcn Registry

This project hosts a custom shadcn/ui registry with components and examples specifically designed for Inbound email integration.

## 🚀 Usage

Users can install components from this registry using the shadcn CLI:

```bash
# Install from production
bunx shadcn@latest add https://inbound.new/r/nextjs-handler.json
bunx shadcn@latest add https://inbound.new/r/webhook-verification.json

# Install from local development
bunx shadcn@latest add http://localhost:3000/r/nextjs-handler.json
```

## 📦 Available Components

### Examples

- **nextjs-handler** - Complete Next.js API route example for handling inbound emails
- **webhook-verification** - Example showing how to verify webhook signatures from Inbound

## 🛠️ Development

### Directory Structure

```
registry/
├── new-york/
│   └── examples/
│       ├── nextjs-handler.tsx
│       └── webhook-verification.tsx
registry.json
public/r/              # Generated JSON files (auto-generated)
```

### Adding New Components

1. Create your component in `registry/new-york/[category]/[component-name].tsx`

2. Add JSDoc comments at the top of your file:

```typescript
/**
 * @name component-name
 * @type registry:example
 * @title Component Display Name
 * @description Brief description of what this component does
 * @registryDependencies ["button", "card"]
 * @dependencies ["package-name@^1.0.0"]
 */
```

3. Add the component to `registry.json`:

```json
{
  "name": "component-name",
  "type": "registry:example",
  "title": "Component Display Name",
  "description": "Brief description",
  "registryDependencies": ["button"],
  "dependencies": [],
  "files": [
    {
      "path": "registry/new-york/examples/component-name.tsx",
      "type": "registry:example"
    }
  ]
}
```

4. Build the registry:

```bash
bun run registry:build
```

This generates JSON files in `public/r/` that can be consumed by the shadcn CLI.

### Building the Registry

```bash
# Build the registry (generates JSON files in public/r/)
bun run registry:build
```

The build process:
1. Reads `registry.json` to find all components
2. Processes each component file
3. Generates individual JSON files in `public/r/`
4. Includes file contents, dependencies, and metadata

### Testing

```bash
# Start the development server
bun run dev

# In another terminal, test adding a component
bunx shadcn@latest add http://localhost:3000/r/nextjs-handler.json
```

## 🌐 API Endpoints

### List all registry items

```
GET /api/r
```

Returns the full registry index with all available components.

### Get individual component

```
GET /api/r/[component-name].json
```

Returns the component definition with code, dependencies, and metadata.

Examples:
- `/api/r/nextjs-handler.json`
- `/api/r/webhook-verification.json`

## 📝 Best Practices

1. **Always add JSDoc comments** - They're used to generate registry metadata
2. **Use relative imports** - Import from `@/registry/...` for consistency
3. **Test before committing** - Build and test locally before pushing
4. **Include examples** - Show real-world usage in your components
5. **Document dependencies** - List all required packages and registry dependencies

## 🔧 Configuration

The registry is configured in:

- `components.json` - shadcn configuration (note: custom registry config moved to registry.json)
- `registry.json` - List of all registry items
- `package.json` - Build script (`registry:build`)

## 📚 Learn More

- [shadcn Registry Documentation](https://ui.shadcn.com/docs/registry/getting-started)
- [Inbound API Documentation](https://inbound.new/docs)
