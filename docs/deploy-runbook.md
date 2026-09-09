# Deploy runbook

Everything below happens in your own browser sessions (AWS console, GitHub). No access key is
created, pasted or stored anywhere: GitHub Actions obtains short-lived credentials from AWS
through OpenID Connect at the moment it runs.

Time: about 20 minutes the first time, five for every later deploy.

## 1. Put the repository on GitHub

Create an empty repository on GitHub (private is fine), then from the project folder:

```bash
git remote add origin https://github.com/<you>/CampaignPulse.git
git push -u origin main
```

## 2. Create the deploy role in AWS (one click, once)

1. Sign in to the AWS console and open **CloudFormation** in the region you will deploy to
   (the workflow defaults to `eu-west-2`, London).
2. **Create stack → With new resources (standard) → Upload a template file** and choose
   `infrastructure/bootstrap/github-oidc-role.yml` from this repository.
3. Stack name `campaignpulse-github-deploy`. Parameters: `GitHubOrg` is your GitHub user name,
   `GitHubRepo` is `CampaignPulse` (or whatever you named it). Leave the rest.
4. Tick the acknowledgement that the stack creates IAM resources and create it.
5. When it reaches `CREATE_COMPLETE`, open the **Outputs** tab and copy `DeployRoleArn`.

The role can only be assumed by workflows running in _your_ repository, and only holds
PowerUser rights plus IAM rights on roles named `campaignpulse-*`.

## 3. Add the repository secrets

GitHub → your repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret               | Value                                                            |
| -------------------- | ---------------------------------------------------------------- |
| `AWS_ROLE_TO_ASSUME` | The `DeployRoleArn` output from step 2                           |
| `ALERT_EMAIL`        | Optional. An address to receive incident notifications by email. |
| `DATABASE_URL`       | Optional. Only if you untick "Create an RDS database" in step 4. |

## 4. Deploy

GitHub → **Actions → Deploy to AWS → Run workflow**. Keep the defaults (stage `dev`, region
`eu-west-2`, create an RDS database ticked) and run it.

The workflow, in order: bundles the three Lambda handlers, provisions the platform and the
functions with Terraform (queues, topic, secret, log groups, alarms, dashboard, S3 + CloudFront,
RDS, Lambda, API Gateway), applies the database migrations, seeds the demo data on a fresh
database, builds the web app against the new API URL and publishes it to CloudFront.

When it finishes, the job **Summary** shows the web app URL, the GraphQL endpoint and a link to
the CloudWatch dashboard. If you set `ALERT_EMAIL`, confirm the subscription email SNS sends.

Re-running the workflow is safe: Terraform is idempotent, migrations only apply
what is new, and the seed step skips a database that already has campaigns.

## 5. Try it

Open the web app URL, pick a campaign, run the **Critical** scenario, and watch the channel turn
critical and an incident open. In the AWS console: the dashboard shows the queue draining and
retries waiting (delayed messages), the delivery worker's log group shows one JSON line per
attempt, and the incident notification arrives by email if subscribed.

## 6. Tear down

**Actions → Tear down AWS stage → Run workflow**, typing the stage name to confirm. It destroys
everything including the database (no final snapshot). The bootstrap
role stack from step 2 stays; delete it in CloudFormation if you no longer want the repository to
be able to deploy.

## Cost while running

At demo volumes the queues, functions, API Gateway, SNS, CloudFront, S3, Secrets Manager and
CloudWatch stay inside or very close to the free tier. The `db.t4g.micro` RDS instance is
free-tier eligible for the first 12 months of an account and roughly $12/month otherwise. Tear
down when you are not demonstrating.

## Alternative: deploy from AWS CloudShell, no key at all

CloudShell (the terminal icon in the console's top bar) runs with your console login's own
permissions, so nothing needs to be created or stored. Upload the repository as a zip (CloudShell
**Actions → Upload file**; produce the zip with `git archive --format=zip -o CampaignPulse.zip HEAD`
or download it from GitHub), then:

```bash
cd /tmp                              # CloudShell's home is capped at 1 GB; /tmp has room
unzip -q ~/CampaignPulse.zip -d campaignpulse && cd campaignpulse
export npm_config_cache=/tmp/npm-cache
bash infrastructure/cloudshell-deploy.sh
```

The script installs Node.js and Terraform into your CloudShell home, creates the Terraform state
bucket, and runs the same steps as the workflow. No third-party account is involved. It prints the web app and API URLs at the end.
Tear down with `bash infrastructure/cloudshell-destroy.sh`. Set `ALERT_EMAIL=you@example.com`
before running to subscribe to incident notifications.

## If you would rather deploy from your own machine

Install the AWS CLI and run `aws configure` with a key from your own IAM user, then follow the
three commands in [aws-deployment.md](aws-deployment.md). The key never needs to leave your
machine or appear in this repository.
