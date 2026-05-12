# TASK

The following branches have been implemented and reviewed by Sandcastle agents:

{{BRANCHES}}

These branches are local-only. Your job is to publish each one as a pull
request on GitHub so the human can review and merge it. **Do NOT merge any
branch into the current branch yourself. Do NOT push to `main`.**

Before doing anything else, ensure git can push using the sandbox's GitHub
credentials. Run `gh auth setup-git` once — this configures git to use the
`gh` CLI's token for HTTPS pushes. If the repo's `origin` remote uses SSH
(e.g. `git@github.com:...`), switch it to HTTPS first:

```
gh repo set-default <owner>/<repo>   # optional, only if gh asks
url=$(gh repo view --json url -q .url)
git remote set-url origin "$url.git"
```

For each branch:

1. Check out the branch: `git checkout <branch>`
2. Verify it has commits ahead of `origin/main`:
   `git log --oneline origin/main..HEAD` — if empty, skip this branch.
3. Sanity-check before publishing:
   - `npm run typecheck` (or `tsc -b`)
   - `npm test` (Vitest)
   If either fails, do NOT push or open a PR for this branch — log the failure
   and move on to the next branch.
4. Push the branch to origin: `git push -u origin <branch>`
5. Open a pull request with `gh pr create`:
   - `--base main`
   - `--head <branch>`
   - `--title` and `--body` summarizing the change. The body MUST include
     `Closes #<ID>` for the corresponding issue ID below so the issue
     auto-closes when the human merges the PR.
   - Use a HEREDOC for `--body` to get correct formatting.
6. Print the resulting PR URL.

After processing every branch, return to `main`: `git checkout main`.

**Do NOT** run `git merge`, `git push origin main`, or `gh issue close` —
issues will close automatically when the human merges the PR.

# ISSUES

Map each branch to its issue ID using this list (the issue ID is what goes
into the `Closes #<ID>` line of the PR body):

{{ISSUES}}

Once every branch has either been turned into a PR or skipped (with a
reason logged), output <promise>COMPLETE</promise>.
