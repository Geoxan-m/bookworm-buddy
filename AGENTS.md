# Architecture rules
- Keep provider calls server-only and classify failures separately from valid zero results; a transport failure must never create a successful search cache.
- Resolve fresh nonempty search cache keys to actual catalogue rows before skipping providers; empty or broken entries must retry.
- Retrieve bounded normalized token candidates on both catalogue paths and rank before limiting; whole-query filtering loses partial and alias matches.
