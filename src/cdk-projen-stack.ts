import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps, RemovalPolicy, Duration, Tags } from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class CdkProjenStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // -------- VPC (public-only, no NAT) --------
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
      ],
    });

    // S3 Gateway Endpoint (no hourly cost)
    new ec2.GatewayVpcEndpoint(this, 'S3Endpoint', {
      vpc,
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // -------- Artifacts & Images --------
    const bucket = new s3.Bucket(this, 'ArtifactsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const repo = new ecr.Repository(this, 'DemoRepo', {
      imageScanOnPush: true,
      lifecycleRules: [{ maxImageCount: 5 }],
    });

    // Example EC2 role (read-only S3)
    const role = new iam.Role(this, 'DemoEc2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'POC EC2 role with read-only S3',
      maxSessionDuration: Duration.hours(12),
    });
    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'),
    );

    // -------- Governance-lite --------
    // CloudTrail → write to our artifacts bucket (avoids extra bucket)
    new cloudtrail.Trail(this, 'OrgTrail', {
      isMultiRegionTrail: false,
      bucket,
    });

    // -------- FinOps: Budget Alert (edit email) --------
    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetLimit: { amount: 5, unit: 'USD' },
        timeUnit: 'MONTHLY',
        budgetType: 'COST',
      },
      notificationsWithSubscribers: [{
        notification: {
          comparisonOperator: 'GREATER_THAN',
          notificationType: 'FORECASTED',
          threshold: 80,
        },
        subscribers: [{ address: 'andy@example.com', subscriptionType: 'EMAIL' }], // <-- change
      }],
    });

    // -------- Tags & Outputs --------
    Tags.of(this).add('Project', 'cdk-projen');
    Tags.of(this).add('Owner', 'AndyHuang');
    Tags.of(this).add('Environment', 'poc');

    new cdk.CfnOutput(this, 'ArtifactsBucketName', { value: bucket.bucketName });
    new cdk.CfnOutput(this, 'EcrRepoUri', { value: repo.repositoryUri });
    new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });
  }
}
