import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { CdkProjenStack } from '../src/cdk-projen-stack';

describe('CdkProjenStack', () => {
  test('synth has expected resources & properties (governance-lite)', () => {
    const app = new cdk.App();
    const stack = new CdkProjenStack(app, 'TestStack', {
      env: { account: '242466199313', region: 'us-east-1' },
    });
    const template = Template.fromStack(stack);

    // Core infra
    template.resourceCountIs('AWS::EC2::VPC', 1);
    template.resourceCountIs('AWS::EC2::NatGateway', 0); // cost hygiene

    template.hasResourceProperties('AWS::EC2::VPCEndpoint', {
      VpcEndpointType: 'Gateway',
      ServiceName: Match.anyValue(), // rendered via intrinsics
      RouteTableIds: Match.anyValue(), // rendered via intrinsics
    });

    // S3 bucket has encryption + public access block
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: Match.arrayWith([
          Match.objectLike({
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: Match.stringLikeRegexp('AES256|aws:kms'),
            },
          }),
        ]),
      },
      PublicAccessBlockConfiguration: Match.anyValue(),
    });

    // ECR scans on push
    template.hasResourceProperties('AWS::ECR::Repository', {
      ImageScanningConfiguration: { ScanOnPush: true },
    });

    // IAM role assume policy
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: { Service: 'ec2.amazonaws.com' },
          }),
        ]),
      },
    });

    // Governance-lite & FinOps
    template.resourceCountIs('AWS::CloudTrail::Trail', 1);
    template.resourceCountIs('AWS::Budgets::Budget', 1);
  });
});
