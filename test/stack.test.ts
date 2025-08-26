import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CdkProjenStack } from '../src/cdk-projen-stack';

test('synth produces expected core resources', () => {
  const app = new cdk.App();
  const stack = new CdkProjenStack(app, 'TestStack', {
    env: { account: '242466199313', region: 'us-east-1' },
  });
  const template = Template.fromStack(stack);

  // Stable resource counts
  template.resourceCountIs('AWS::S3::Bucket', 1);
  template.resourceCountIs('AWS::ECR::Repository', 1);
  template.resourceCountIs('AWS::EC2::VPC', 1);

  // Instead of counting IAM roles, assert the EC2 role exists by properties
  template.hasResourceProperties('AWS::IAM::Role', {
    AssumeRolePolicyDocument: {
      Statement: [{
        Action: 'sts:AssumeRole',
        Effect: 'Allow',
        Principal: { Service: 'ec2.amazonaws.com' },
      }],
      Version: '2012-10-17',
    },
  });
});
