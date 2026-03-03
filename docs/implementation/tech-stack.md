# Technology Stack

## Core Technologies

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.x | React framework with App Router |
| React | 19.x | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Utility-first CSS |
| shadcn/ui | latest | Component library |
| TanStack Query | 5.x | Data fetching and caching |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js API Routes | 15.x | API server |
| GitHub OAuth + jose | latest | OAuth login + Bearer JWT authentication |
| MatrixOne | existing | Primary database |
| Drizzle ORM | latest | Type-safe SQL |
| WebSocket (ws) | latest | Real-time updates |

### Monorepo Tooling

| Technology | Version | Purpose |
|------------|---------|---------|
| pnpm workspaces | 10.x | Workspace package management |
| Turborepo | 2.x | Task orchestration and caching |

### AI Integration

| Technology | Version | Purpose |
|------------|---------|---------|
| Anthropic SDK | latest | Claude API |
| Vercel AI SDK | latest | Streaming responses |
| MCP SDK | latest | Model Context Protocol |

### Agent Runtime

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20.x | Runtime |
| TypeScript | 5.x | Type safety |
| simple-git | latest | Git operations |
| @anthropic-ai/sdk | latest | AI integration |

## Package Installation

### Web Application

```bash
cd apps/web

# Core
pnpm add next@latest react@latest react-dom@latest
pnpm add typescript @types/react @types/node

# Styling
pnpm add tailwindcss postcss autoprefixer
npx tailwindcss init -p

# UI Components
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input textarea badge avatar dropdown-menu dialog tabs scroll-area separator

# Database
pnpm add drizzle-orm mysql2
pnpm add -D drizzle-kit

# Authentication
pnpm add jose

# Data Fetching
pnpm add @tanstack/react-query @tanstack/react-query-devtools

# AI
pnpm add @anthropic-ai/sdk ai

# Utilities
pnpm add clsx tailwind-merge zod date-fns
pnpm add lucide-react

# WebSocket
pnpm add ws @types/ws

# Forms
pnpm add react-hook-form @hookform/resolvers
```

### Agent Runtime

```bash
cd apps/agent-runtime

# Core
pnpm init
pnpm add typescript @types/node ts-node

# AI
pnpm add @anthropic-ai/sdk
pnpm add @modelcontextprotocol/sdk

# Git
pnpm add simple-git @types/simple-git

# GitHub
pnpm add @octokit/rest

# Utilities
pnpm add dotenv winston zod

# Development
pnpm add -D tsx nodemon
```

## Configuration Files

### Next.js (next.config.js)

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mysql2'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/webhooks/github',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'POST' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

### Tailwind (tailwind.config.js)

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Priority colors
        priority: {
          p0: '#DC2626',
          p1: '#F97316',
          p2: '#F59E0B',
          p3: '#6B7280',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
            from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.5' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
```

### TypeScript (tsconfig.json)

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Drizzle (drizzle.config.ts)

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## Development Scripts

### Web Application (package.json)

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "type-check": "tsc --noEmit"
  }
}
```

### Agent Runtime (package.json)

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "type-check": "tsc --noEmit"
  }
}
```

## Development Tools

### Recommended VS Code Extensions

- **TypeScript**: ms-vscode.vscode-typescript-next
- **Tailwind**: bradlc.vscode-tailwindcss
- **ESLint**: dbaeumer.vscode-eslint
- **Prettier**: esbenp.prettier-vscode
- **Database**: weisionhong.drizzle-kit

### ESLint Configuration

```javascript
// .eslintrc.js
module.exports = {
  extends: ['next/core-web-vitals', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
};
```

### Prettier Configuration

```javascript
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```
