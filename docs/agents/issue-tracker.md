# Issue tracker: GitHub

Issues and specs live in GitHub Issues for `ThienHN0910/sentinel-bot`. Use `gh` from this clone.

- Create: `gh issue create --title "..." --body-file <file>`
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open --json number,title,body,labels,comments`
- Comment: `gh issue comment <number> --body-file <file>`
- Label: `gh issue edit <number> --add-label <label>` or `--remove-label <label>`
- Close: `gh issue close <number>`

PRs as a request surface: no. Triage issues; do not automatically treat external PRs as feature requests.
When a skill says "publish to the issue tracker", create a GitHub issue.
When it says "fetch the relevant ticket", read the GitHub issue.

For wayfinding, use one issue labelled `wayfinder:map`, child issues as tickets,
and GitHub issue dependencies for blockers where available. Fall back to a
`Blocked by: #<number>` line if dependencies are unavailable.
