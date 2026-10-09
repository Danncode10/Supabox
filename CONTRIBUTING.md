# Contributing to Supabox

Thanks for helping out. Bug reports, fixes and ideas are all welcome.

## Getting started

1. Fork the repo and clone your fork.
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and fill in your own Supabase project's values. Never commit `.env.local`.
4. Apply the database schema: `npm run db:link` then `npm run db:migrate`
5. Start the app: `npm run dev` and open http://localhost:3000

Local model training (Testing tab) needs Python 3. The app installs YOLO into a gitignored `.venv` for you, and trained models go to the gitignored `models/` folder.

## Before you open a pull request

Run all of these and make sure they pass:

```bash
npm run typecheck
npm run lint
npm run test:yolo
npm run test:detect
npm run build
```

## Pull requests

- Branch from `main` and keep each PR to one change.
- Describe what changed and why. Add a screenshot for UI changes, at desktop and phone width.
- Match the surrounding code style (TypeScript, Tailwind, existing components in `src/components/ui`).
- Database changes go in a new file under `supabase/migrations/`. Don't edit an existing migration.
- Keep Row Level Security on for every table, and don't expose the service role key to the browser.

## Commit messages

Short and in the imperative, prefixed with a type, for example `feat: add class color picker` or `fix: stop epoch count passing the total`.

## Reporting bugs

Open an issue with the steps to reproduce, what you expected, what happened, and your browser and OS. Remove any keys, tokens or private image links first.

## License

By contributing you agree that your work is released under the [MIT License](LICENSE).
