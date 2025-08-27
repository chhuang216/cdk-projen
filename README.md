# CDK-PROJEN

Minimal, production-style **Infrastructure as Code** using **AWS CDK (TypeScript)** scaffolded with **Projen**.  
It deploys a tiny, cost-safe cloud foundation suitable for ML/DS workloads and demonstrates good IaC hygiene (tests, CI, reproducible synth, teardown).

[![build](https://github.com/chhuang216/cdk-projen/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/chhuang216/cdk-projen/actions/workflows/build.yml)

---

## What this deploys

- **VPC (public-only, 1 AZ, _no NAT_)** — free to idle (`natGateways: 0`), for demos and public endpoints.
- **S3 artifacts bucket** — S3-managed encryption, public access blocked, **autoDeleteObjects** for clean teardown.
- **ECR repository** — image scanning on push, lifecycle policy (keep few images).
- **IAM role (EC2)** — example service role with **AmazonS3ReadOnlyAccess**.
- **CloudFormation Outputs** — prints bucket name, ECR URI, and VPC ID after deploy.
- **Tags** — basic `Project/Owner/Environment` for cost visibility.

---

## What this demonstrates

- **CDK + TypeScript**: model infra as code with reviewable diffs and repeatable deploy/destroy.
- **Projen**: automated project scaffolding, scripts, linting, and test harness.
- **Reproducibility**: `cdk.context.json` committed so synth works in CI without lookups.
- **Testing & CI**: `aws-cdk-lib/assertions` + GitHub Actions `synth/diff`.
- **Ops & FinOps**: no-NAT VPC for $0 idle; lifecycle policies; teardown scripts.
- **Extensible platform**: hooks for EKS + ArgoCD, Airflow + MLflow/DVC, SageMaker/Bedrock, governance & observability

---

### Architecture notes (high level)

- **Network**: single-AZ public VPC (demo) with S3 Gateway Endpoint; production would add private subnets, endpoint strategy (private, no egress), and perimeter controls.
- **Artifacts**: S3 (encrypted) + ECR (scan on push + lifecycle).
- **Identity**: IAM roles (least-privilege in prod), OIDC to GitHub for CDK deploys (no long-lived keys).
- **Controls**: Config + CloudTrail + GuardDuty baselines; tag policies + budgets.

---

## Repo layout

```
src/
  main.ts                   # CDK app entry (sets env)
  cdk-projen-stack.ts       # VPC/S3/ECR/IAM + Outputs + Tags
test/
  stack.test.ts             # Template assertions (S3/ECR/VPC/IAM role exists)
.github/workflows/
  cdk.yml                   # CI: projen -> synth -> diff
.projenrc.ts                # Projen project definition
cdk.context.json            # Committed context for reproducible synths
package.json
README.md
```

---

## Prerequisites

- Node.js **18+**, npm
- AWS CLI v2 (`aws --version`)
- An AWS account & IAM auth (either **SSO** or **Access Keys** via `aws configure`)
- Optional: `npx` (included with npm)

---

## Quick start (exact commands)

> Replace the profile name if you use something other than `cdk`.

### 1) Configure AWS credentials (one time)

```bash
aws configure --profile cdk
# AWS Access Key ID: <your key>
# AWS Secret Access Key: <your secret>
# Default region: <your AWS region>
# Default output: json
export AWS_PROFILE=cdk
export AWS_REGION=us-east-1
export AWS_SDK_LOAD_CONFIG=1
aws sts get-caller-identity --query Account --output text
```

### 2) Bootstrap the account/region for CDK (one time per account/region)

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
npx cdk bootstrap aws://$ACCOUNT_ID/$AWS_REGION   --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess
```

### 3) Build, test, synth

```bash
npx projen
npm run build          # runs jest + eslint + cdk synth
```

### 4) Deploy

```bash
npx cdk deploy --require-approval never
```

### 5) Verify

```bash
# CloudFormation Outputs
aws cloudformation describe-stacks --stack-name CdkProjenStack   --query 'Stacks[0].Outputs' --output table

# VPC name and ID (should show the CDK VPC and default VPC)
aws ec2 describe-vpcs --region "$AWS_REGION"   --query 'Vpcs[].{VpcId:VpcId,Name:Tags[?Key==`Name`]|[0].Value}' --output table

# ECR repos (CDK repo + bootstrap assets repo)
aws ecr describe-repositories --region "$AWS_REGION" --query 'repositories[].repositoryUri' --output text

# S3 buckets (stack bucket + bootstrap assets bucket)
aws s3 ls
```

---

## Clean teardown

```bash
# If you pushed images to ECR, delete them first:
aws ecr describe-images --repository-name "$ECR_REPO"   --query 'imageDetails[].imageDigest' --output text | xargs -I{} aws ecr batch-delete-image   --repository-name "$ECR_REPO" --image-ids imageDigest={}

# Then destroy the stack (S3 auto-deletes objects via Bucket policy)
npx cdk destroy --force
```

> You can keep the **CDKToolkit** (bootstrap) stack around. Remove it only if you won’t deploy again soon.

---

## CI (GitHub Actions)

A lightweight workflow runs `projen → synth → diff` on every push/PR.

```
.github/workflows/cdk.yml
```

Add a badge to this README (already set for **chhuang216/cdk-projen**). If your repo path differs, update the URL.

```md
![cdk-synth-diff](https://github.com/<your-username>/cdk-projen/actions/workflows/cdk.yml/badge.svg)
```

---

## Tests

Template assertions with `aws-cdk-lib/assertions`:

- S3 bucket exists and is encrypted
- ECR repo exists
- VPC exists
- EC2 IAM role’s assume policy targets `ec2.amazonaws.com`

Run locally:

```bash
npm test
```

---

## Troubleshooting (fast)

- **No credentials / Auth errors**  
  Export profile & region and re-run:
  ```bash
  export AWS_PROFILE=cdk
  export AWS_REGION=us-east-1
  aws sts get-caller-identity
  ```

- **`ec2:DescribeAvailabilityZones` denied during synth**  
  Attach a broader policy temporarily (e.g., `AdministratorAccess`) or commit `cdk.context.json` after a successful synth.

- **CIDR conflict when changing VPC topology**  
  Either `cdk destroy` first, or change **both** the VPC **CIDR** and the **logical ID** (e.g., `VpcPublicOnly` with `10.1.0.0/16`) to force a replacement.

- **`Unknown output type: JSON`**  
  Output must be lower-case: `aws configure set output json --profile cdk`.

---

