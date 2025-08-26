import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps, RemovalPolicy, Duration, Tags } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class CdkProjenStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // VPC (2 AZs)
    const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 2 });

    // S3 bucket (safe teardown)
    const bucket = new s3.Bucket(this, 'ArtifactsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ECR repo with scan + lifecycle
    const repo = new ecr.Repository(this, 'DemoRepo', {
      imageScanOnPush: true,
      lifecycleRules: [{ maxImageCount: 10 }],
    });

    // Example EC2 role with S3 read-only
    const role = new iam.Role(this, 'DemoEc2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'POC EC2 role with read-only S3',
      maxSessionDuration: Duration.hours(12),
    });
    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'),
    );

    // ===== Outputs (must be inside the constructor) =====
    new cdk.CfnOutput(this, 'ArtifactsBucketName', { value: bucket.bucketName });
    new cdk.CfnOutput(this, 'EcrRepoUri', { value: repo.repositoryUri });
    new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });

    // ===== Tags (also inside the constructor) =====
    Tags.of(this).add('Project', 'cdk-projen');
    Tags.of(this).add('Owner', 'AndyHuang');
    Tags.of(this).add('Environment', 'poc');
  }
}
