This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Production Release Checklist

### 1) Rotate exposed API keys before going public
- Rotate `TMDB_API_KEY` and `RAWG_API_KEY` in their provider dashboards.
- Update local `.env.local` with the new values.

### 2) Keep secrets out of git
- `.env*` is ignored by `.gitignore`.
- Only commit `.env.example` with placeholder values.

### 3) Configure deployment environment variables
Set these in your hosting provider (for example Vercel), not in git:
- `TMDB_API_KEY`
- `RAWG_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4) Supabase security checks
- Enable Row Level Security (RLS) on all user data tables.
- Add explicit policies for anon/authenticated access.
- Never expose a Supabase `service_role` key to client code.

### 5) Pre-push validation
Run before publishing:

```bash
npm run lint
npm run build
```

### 6) Publish repository safely
After rotating keys and confirming no secrets are tracked:

```bash
git status
git ls-files | findstr /R "^.env"
git add .
git commit -m "production prep"
git push origin main
```

Then set GitHub repo visibility to **Public**.
