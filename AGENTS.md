# Rangers Training collaboration

Work only in this new repository. Keep the original rangerschun/rangerschun.github.io and Google backend untouched as fallback.

Use branches chatgpt/<topic>, claude/<topic>, or gemini/<topic> and pull requests into main. Describe changes and validation; resolve conflicts before merging. Do not force push. Each AI requires its own GitHub connection.

Use relative asset paths under /rangers-training/. All browser records must use training-storage.mjs and all backend calls must use training-config.mjs with the copied Apps Script deployment. Never commit private backend secrets, password hashes, access codes or team feed tokens.

The active app is docs/app-home-85bcf3f0ccd0.mjs. Update it alongside relevant source modules. Run isolation, syntax and browser checks before release. Verify a disposable write reaches only the copied Sheet before claiming end-to-end isolation.
