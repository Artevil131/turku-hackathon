# Auto-deploy to yourlab.aapolipponen.com

Every push to `main` deploys to https://yourlab.aapolipponen.com through
`.github/workflows/deploy.yml` (also runnable by hand: Actions → deploy → Run
workflow). The job opens one SSH connection to the OCI host; the host runs
`aei-deploy` (this directory), which fast-forwards `~/aei` to `origin/main`,
rebuilds and restarts the compose stack, and waits until the web and API
answer. The job then checks the public address. A failed build leaves the old
site running, since compose builds the images before replacing containers.
Deploys run one at a time; a push during a deploy waits for it. It does not
wait for the `check` workflow.

## Pieces (set up 2026-10-17)

- **Host:** `aei-deploy` installed as `/home/opc/bin/aei-deploy`. After
  changing the copy here, reinstall it: `scp deploy/autodeploy/aei-deploy
  oci:bin/aei-deploy`. The workflow never runs the repository's copy.
- **Key:** an ed25519 key made for this alone. Its line in
  `~opc/.ssh/authorized_keys` is
  `command="/home/opc/bin/aei-deploy",restrict ssh-ed25519 … github-actions
  deploy yourlab`, so the key can run the deploy and nothing else: no shell,
  no forwarding. Only GitHub holds the private half.
- **Repository secrets:** `DEPLOY_SSH_KEY` (that private key),
  `DEPLOY_KNOWN_HOSTS` (the host's ed25519 key, checked against a known
  fingerprint when it was stored) and `DEPLOY_HOST` (130.61.169.101).

To revoke: delete the `github-actions deploy yourlab` line from
`authorized_keys`. To rotate: make a new key, replace that line and
`DEPLOY_SSH_KEY`.
