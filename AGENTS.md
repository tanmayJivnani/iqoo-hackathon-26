# Team workflow

- Before starting a user-requested change, check the working tree and pull the latest origin branch. Preserve uncommitted work; never discard it to pull.
- After completing each requested update, commit and push immediately. If the remote advances, integrate its changes and retry without force-pushing.
- Keep shared code and scripts compatible with Windows and Linux. Discover local SDK/JDK paths instead of committing machine-specific paths; isolate operating-system-specific commands.
- The user handles phone UI testing. Do not tap, swipe, or capture the phone screen unless explicitly requested; read logs when needed.
