#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkProjenStack } from './cdk-projen-stack';

const app = new cdk.App();
new CdkProjenStack(app, 'CdkProjenStack', {
  env: { account: '242466199313', region: 'us-east-1' },
});
