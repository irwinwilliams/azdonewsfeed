# Azure DevOps News Feed

A modern, secure web application for monitoring Azure DevOps activity across your organization. Get a unified, real-time feed of pull requests and work items from all your projects in one place.

![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Tests](https://img.shields.io/badge/tests-43%20passing-success)
![Security](https://img.shields.io/badge/vulnerabilities-0-success)

## ✨ Features

### Activity Monitoring
- **Unified Feed**: View pull requests and work items from all projects in a single timeline
- **Real-time Updates**: Automatic refresh with background caching for offline access
- **Smart Filtering**: Filter by type, project, person, work item type, PR status, or search
- **Customizable Time Range**: From last hour to all-time activity
- **Personal Notes**: Add private notes to any PR or work item
- **Pin & Save**: Pin important items and save for later review

### Security-First Design
- ✅ **Comprehensive Input Validation** with Zod schemas
- ✅ **Content Security Policy** and security headers (HSTS, X-Frame-Options, etc.)
- ✅ **CSRF Protection** on all API endpoints
- ✅ **Client-side Rate Limiting** to prevent abuse
- ✅ **Error Sanitization** to prevent information leakage
- ✅ **Request Timeouts** to prevent hanging connections
- ✅ **WIQL Injection Prevention** for work item queries
- ✅ **Zero Dependencies Vulnerabilities**

### User Experience
- 🎨 Beautiful, responsive UI built with Tailwind CSS
- 🚀 Fast performance with Next.js 16 and Turbopack
- 💾 Offline-capable with localStorage caching
- 📱 Mobile-friendly responsive design
- 🔔 New item notifications with visual indicators
- 📊 Activity statistics and metrics

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ 
- npm or yarn
- Azure DevOps Personal Access Token with read permissions

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd azdonewsfeed

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Configuration

1. Click **Settings** in the navigation
2. Enter your Azure DevOps **Organization** name
3. Create a **Personal Access Token** (PAT) with these scopes:
   - **Code**: Read (for pull requests)
   - **Work Items**: Read (for work items)
4. Configure your preferences:
   - Time range (e.g., last 7 days or all time)
   - Projects to monitor (specific projects or all)
   - Fetch limits for PRs and work items
5. Click **Test Connection** to verify
6. Click **Save** to start monitoring

## 🔒 Security

This application takes security seriously. See [SECURITY.md](SECURITY.md) for comprehensive documentation.

### Important Security Notes

⚠️ **PAT Storage**: Your Personal Access Token is stored in browser localStorage. This is suitable for development but has limitations:
- Only use **read-only PATs** with minimal permissions
- Never use admin or write permissions
- Your PAT is only sent to Azure DevOps APIs, never to third parties
- Use only on trusted devices

### Security Features
- All traffic forced over HTTPS
- Comprehensive Content Security Policy
- Input validation on all user inputs
- Rate limiting to prevent API abuse
- CSRF protection on all POST endpoints
- Sanitized error messages

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

**Test Coverage**: 43 tests covering security features, validation, rate limiting, and UI components.

## 📁 Project Structure

```
azdonewsfeed/
├── src/
│   ├── app/                 # Next.js app router pages
│   │   ├── api/            # API routes
│   │   ├── settings/       # Settings page
│   │   └── page.tsx        # Home page
│   ├── components/         # React components
│   │   ├── FeedShell.tsx   # Main feed component
│   │   ├── PostCard.tsx    # Feed item card
│   │   └── DetailPanel.tsx # Detail sidebar
│   └── lib/                # Utilities and libraries
│       ├── azdo.ts         # Azure DevOps API client
│       ├── validation.ts   # Input validation schemas
│       ├── ratelimit.ts    # Rate limiting utility
│       └── types.ts        # TypeScript types
├── __tests__/              # Test files
├── SECURITY.md             # Security documentation
└── package.json
```

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Language**: [TypeScript 5](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Validation**: [Zod](https://zod.dev/)
- **Testing**: [Jest](https://jestjs.io/) + [React Testing Library](https://testing-library.com/react)
- **Build Tool**: [Turbopack](https://turbo.build/pack)

## 📝 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```

## 🎯 Use Cases

- **Development Teams**: Monitor PR activity across all repositories
- **Project Managers**: Track work item progress in real-time
- **DevOps Engineers**: Unified view of development and operations activity
- **Team Leads**: Stay informed on team contributions and blockers
- **Individual Developers**: Follow work that matters to you

## 🤝 Contributing

Contributions are welcome! Please ensure:
- All tests pass (`npm test`)
- Code follows TypeScript best practices
- Security considerations are addressed
- Documentation is updated

## 📄 License

This project is for demonstration and educational purposes.

## 🙏 Acknowledgments

Built with [Next.js](https://nextjs.org/) and powered by the [Azure DevOps REST API](https://learn.microsoft.com/en-us/rest/api/azure/devops/).

---

**Note**: This is a client-side application with PAT-based authentication. For production use with sensitive organizations, consider implementing OAuth 2.0 and server-side authentication. See [SECURITY.md](SECURITY.md) for details.
