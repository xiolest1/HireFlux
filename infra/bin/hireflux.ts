#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { composeEnvironment } from '../lib/app';

const app = new App({ analyticsReporting: false });
composeEnvironment(app);
app.synth();
