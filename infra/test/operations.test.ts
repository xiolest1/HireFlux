import assert from 'node:assert/strict';
import { test } from 'node:test';
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { loadEnvironmentConfig } from '../lib/config/environment';
import { HireFluxStack } from '../lib/hireflux-stack';
import { fixtureArtifact } from './fixture';
import { REVIEWED_RESOURCES } from './resource-inventory';

const ids = {
  lambdaLogs: 'OperationalLogsBackendFunctionLogs44D131F8', apiLogs: 'OperationalLogsHttpApiAccessLogs3515ABA0',
  function: 'BackendApiBackendFunctionFFB5248D', api: 'BackendApiHttpApiB4B1202A', table: 'WorkspaceTable68AC2584',
  stage: 'BackendApiHttpApiDefaultStage89B5186D', policy: 'BackendApiExecutionRoleDefaultPolicyDE57D6A3',
  topic: 'OperationsOperationalAlerts7AC1A668', subscription: 'OperationsOperationalAlertSubscription953AAEA9',
  topicPolicy: 'OperationsOperationalAlertPolicy4A085B4E', dashboard: 'OperationsOperationalDashboard098A469E',
  budget: 'OperationsMonthlyCostBudgetFC194922',
};
const alarmIds = [
  'OperationsLambdaErrors5904FFE2', 'OperationsLambdaThrottles66F0659C', 'OperationsHttpApiServerErrors8A0F4370',
  'OperationsDynamoDBThrottlesAF8DF63F', 'OperationsDynamoDBSystemErrorsB63796D3',
];
const suffixes = ['lambda-errors', 'lambda-throttles', 'api-5xx', 'dynamodb-throttles', 'dynamodb-system-errors'];
const operations = ['GetItem', 'PutItem', 'DeleteItem', 'Query', 'BatchWriteItem', 'TransactWriteItems'];
const ref = (id: string) => ({ Ref: id });
const arn = (id: string) => ({ 'Fn::GetAtt': [id, 'Arn'] });
const ABSENT = Symbol('AWS::NoValue');

// Evaluate the actual parameter-driven conditions, not a second hand-written alert policy.
function resolveTemplate(template: any, email: string): any {
  function resolve(value: any): any {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(resolve).filter((child) => child !== ABSENT);
    if (value.Ref === 'AWS::NoValue') return ABSENT;
    if (value.Ref === 'OperationalAlertEmail') return email;
    if (value.Ref === 'AWS::Region') return template.Metadata.HireFlux.awsRegion;
    if (value.Ref) return `resource:${value.Ref}`;
    if (value['Fn::GetAtt']) return `resource:${value['Fn::GetAtt'].join('.')}`;
    if (value['Fn::Equals']) return resolve(value['Fn::Equals'][0]) === resolve(value['Fn::Equals'][1]);
    if (value['Fn::Not']) return !resolve(value['Fn::Not'][0]);
    if (value['Fn::If']) {
      const [condition, yes, no] = value['Fn::If'];
      return resolve(resolve(template.Conditions[condition]) ? yes : no);
    }
    if (value['Fn::Join']) return resolve(value['Fn::Join'][1]).join(value['Fn::Join'][0]);
    return Object.fromEntries(Object.entries(value).flatMap(([key, child]) => {
      const result = resolve(child); return result === ABSENT ? [] : [[key, result]];
    }));
  }
  return Object.fromEntries(Object.entries(template.Resources).flatMap(([id, resource]: [string, any]) =>
    resource.Condition && !resolve(template.Conditions[resource.Condition]) ? [] : [[id, resolve(resource)]]));
}

function assertAccessLogPrivacy(format: string): void {
  assert.deepEqual(JSON.parse(format), {
    requestId: '$context.requestId', routeKey: '$context.routeKey', httpMethod: '$context.httpMethod',
    status: '$context.status', responseLength: '$context.responseLength', responseLatency: '$context.responseLatency',
    integrationLatency: '$context.integrationLatency', protocol: '$context.protocol', integrationStatus: '$context.integration.status',
  });
  assert.doesNotMatch(format, /authorization|cookie|query|body|sourceIp|userAgent|identity|claims|email|token|secret|\$context\.path|error\.message/i);
  assert.ok(!format.includes('\n'));
}

function assertOperationAlarm(properties: any, metricName: string): void {
  assert.equal(properties.Namespace, undefined);
  const visible = properties.Metrics.filter((metric: any) => metric.ReturnData === true);
  assert.equal(visible.length, 1);
  const sources = properties.Metrics.filter((metric: any) => metric.MetricStat);
  assert.equal(sources.length, operations.length);
  assert.equal(visible[0].Expression, `SUM([${sources.map((metric: any) => metric.Id).join(',')}])`);
  assert.deepEqual(sources.map((metric: any) => metric.MetricStat.Metric.Dimensions.find((dimension: any) => dimension.Name === 'Operation').Value), operations);
  for (const source of sources) {
    assert.equal(source.ReturnData, false);
    assert.equal(source.MetricStat.Period, 300);
    assert.equal(source.MetricStat.Stat, 'Sum');
    assert.deepEqual(source.MetricStat.Metric, {
      Namespace: 'AWS/DynamoDB', MetricName: metricName,
      Dimensions: [
        { Name: 'Operation', Value: operations[sources.indexOf(source)] },
        { Name: 'TableName', Value: ref(ids.table) },
      ],
    });
  }
}

for (const environment of ['staging', 'production'] as const) {
  const config = loadEnvironmentConfig(environment);
  const stack = new HireFluxStack(new App(), `HireFlux-${environment}`, config, fixtureArtifact);
  const template = Template.fromStack(stack).toJSON();
  const resources = template.Resources;

  test(`${environment} operational resources have stable identities and no unexpected family`, () => {
    assert.deepEqual(Object.fromEntries(Object.entries(resources).map(([id, resource]: [string, any]) => [id, resource.Type])), REVIEWED_RESOURCES);
    assert.deepEqual(template.Outputs ?? {}, {});
    assert.equal(stack.operationalLogs.backendFunctionLogs.node.id, 'BackendFunctionLogs');
    assert.equal(stack.operationalLogs.httpApiAccessLogs.node.id, 'HttpApiAccessLogs');
    assert.equal(stack.operations.dashboard.node.id, 'OperationalDashboard');
    assert.equal(stack.operations.budget.node.id, 'MonthlyCostBudget');
    for (const id of [ids.lambdaLogs, ids.apiLogs, ...alarmIds, ids.topic]) {
      assert.deepEqual(resources[id].Properties.Tags, Object.entries(config.tags).sort().map(([Key, Value]) => ({ Key, Value })));
    }
    assert.deepEqual(resources[ids.budget].Properties.ResourceTags, Object.entries(config.tags).map(([Key, Value]) => ({ Key, Value })));
    assert.equal(Object.values(resources).filter((resource: any) => resource.Type === 'AWS::IAM::Role').length, 1);
    assert.doesNotMatch(JSON.stringify(template), /AWS::ApiGateway::|AWS::Budgets::BudgetsAction|AWS::Logs::MetricFilter|AWS::Logs::SubscriptionFilter|Custom::|Fn::ImportValue/);
  });

  test(`${environment} separate standard log groups have finite retention and deliberate lifecycle`, () => {
    for (const [id, retention] of [[ids.lambdaLogs, config.operations.lambdaLogRetentionDays], [ids.apiLogs, config.operations.apiLogRetentionDays]] as const) {
      const group = resources[id];
      assert.equal(group.Properties.LogGroupClass, 'STANDARD');
      assert.equal(group.Properties.RetentionInDays, retention);
      assert.equal(group.Properties.LogGroupName, undefined);
      assert.equal(group.DeletionPolicy, environment === 'production' ? 'Retain' : 'Delete');
      assert.equal(group.UpdateReplacePolicy, environment === 'production' ? 'Retain' : 'Delete');
    }
    assert.deepEqual(resources[ids.function].Properties.LoggingConfig, {
      LogGroup: ref(ids.lambdaLogs), LogFormat: 'JSON', ApplicationLogLevel: 'WARN', SystemLogLevel: 'WARN',
    });
    assert.deepEqual(resources[ids.stage].Properties.AccessLogSettings.DestinationArn, arn(ids.apiLogs));
  });

  test(`${environment} access-log fields are the exact privacy-safe supported HTTP API variables`, () =>
    assertAccessLogPrivacy(resources[ids.stage].Properties.AccessLogSettings.Format));

  test(`${environment} one existing API stage and function enforce only the reviewed scaling controls`, () => {
    assert.deepEqual(resources[ids.stage].Properties.DefaultRouteSettings, {
      DetailedMetricsEnabled: false, ThrottlingRateLimit: config.operations.apiThrottleRate,
      ThrottlingBurstLimit: config.operations.apiThrottleBurst,
    });
    assert.equal(resources[ids.stage].Properties.RouteSettings, undefined);
    assert.equal(resources[ids.function].Properties.ReservedConcurrentExecutions, config.operations.lambdaReservedConcurrency);
    assert.ok(config.operations.lambdaReservedConcurrency > 0);
    for (const type of ['AWS::Lambda::Function', 'AWS::ApiGatewayV2::Api', 'AWS::ApiGatewayV2::Stage'])
      assert.equal(Object.values(resources).filter((resource: any) => resource.Type === type).length, 1);
    assert.doesNotMatch(JSON.stringify(template), /ProvisionedConcurrencyConfig|AWS::Lambda::Alias|AWS::Lambda::Version|AWS::Lambda::EventSourceMapping|PutMetricData|xray:|AWSLambdaBasicExecutionRole/);
  });

  test(`${environment} all five native alarms have deliberate statistics, evaluation, scope and missing-data policy`, () => {
    assert.equal(Object.values(resources).filter((resource: any) => resource.Type === 'AWS::CloudWatch::Alarm').length, 5);
    for (const [index, id] of alarmIds.entries()) {
      const p = resources[id].Properties;
      assert.equal(p.AlarmName, `hireflux-${environment}-${suffixes[index]}`);
      assert.equal(p.ComparisonOperator, 'GreaterThanOrEqualToThreshold');
      assert.equal(p.Threshold, 1);
      assert.equal(p.EvaluationPeriods, index === 4 ? 3 : 1);
      assert.equal(p.DatapointsToAlarm, index === 4 ? 2 : 1);
      assert.equal(p.TreatMissingData, 'notBreaching');
      assert.deepEqual(p.AlarmActions, [{ 'Fn::If': ['HasOperationalAlertEmail', ref(ids.topic), ref('AWS::NoValue')] }]);
      assert.equal(p.OKActions, undefined);
      assert.equal(p.InsufficientDataActions, undefined);
      assert.doesNotMatch(JSON.stringify(p), /4xx|ConditionalCheckFailedRequests|UserErrors|EstimatedCharges|AWS\/Billing|CURSOR|SIGNING|AmplifyGitHubAccessToken/);
      if (index < 3) {
        assert.equal(p.Namespace, index === 2 ? 'AWS/ApiGateway' : 'AWS/Lambda');
        assert.equal(p.MetricName, ['Errors', 'Throttles', '5xx'][index]);
        assert.equal(p.Statistic, 'Sum');
        assert.equal(p.Period, 300);
        assert.deepEqual(p.Dimensions, [{ Name: index === 2 ? 'ApiId' : 'FunctionName', Value: ref(index === 2 ? ids.api : ids.function) }]);
      } else assertOperationAlarm(p, index === 3 ? 'ThrottledRequests' : 'SystemErrors');
    }
  });

  test(`${environment} optional email never enters application configuration and conditions both notification paths`, () => {
    assert.deepEqual(Object.keys(template.Parameters).sort(), ['AmplifyGitHubAccessToken', 'BootstrapVersion', 'OperationalAlertEmail']);
    assert.deepEqual(template.Parameters.OperationalAlertEmail, { Type: 'String', Default: '', NoEcho: true, MaxLength: 254,
      AllowedPattern: '^$|^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
      Description: 'Optional deploy-time operator notification email; confirmation and delivery are Phase 4 gates.' });
    assert.deepEqual(template.Conditions.HasOperationalAlertEmail, { 'Fn::Not': [{ 'Fn::Equals': [ref('OperationalAlertEmail'), ''] }] });
    for (const id of [ids.topic, ids.subscription, ids.topicPolicy]) assert.equal(resources[id].Condition, 'HasOperationalAlertEmail');
    assert.deepEqual(resources[ids.subscription].Properties, { Endpoint: ref('OperationalAlertEmail'), Protocol: 'email', TopicArn: ref(ids.topic) });
    for (const id of [ids.function, 'FrontendHostingApp3EC0FC15', 'FrontendHostingBranchB5734B41'])
      assert.ok(!JSON.stringify(resources[id]).includes('OperationalAlertEmail'));
    const blank = resolveTemplate(template, '');
    const provided = resolveTemplate(template, 'operator@example.invalid');
    assert.equal(Object.keys(blank).length, 22);
    assert.equal(Object.keys(provided).length, 25);
    for (const id of [ids.topic, ids.subscription, ids.topicPolicy]) assert.equal(blank[id], undefined);
    for (const id of alarmIds) {
      assert.deepEqual(blank[id].Properties.AlarmActions, []);
      assert.deepEqual(provided[id].Properties.AlarmActions, [`resource:${ids.topic}`]);
    }
    assert.equal(blank[ids.budget].Properties.NotificationsWithSubscribers, undefined);
    assert.deepEqual(provided[ids.budget].Properties.NotificationsWithSubscribers, [80, 100].map((Threshold) => ({
      Notification: { ComparisonOperator: 'GREATER_THAN', NotificationType: 'ACTUAL', Threshold, ThresholdType: 'PERCENTAGE' },
      Subscribers: [{ Address: 'operator@example.invalid', SubscriptionType: 'EMAIL' }],
    })));
    const statement = resources[ids.topicPolicy].Properties.PolicyDocument.Statement;
    assert.equal(statement.length, 1);
    assert.deepEqual(statement[0].Principal, { Service: 'cloudwatch.amazonaws.com' });
    assert.equal(statement[0].Action, 'sns:Publish');
    assert.deepEqual(statement[0].Resource, ref(ids.topic));
    assert.deepEqual(statement[0].Condition.StringEquals, { 'aws:SourceAccount': ref('AWS::AccountId') });
    assert.equal(statement[0].Condition.ArnEquals['aws:SourceArn'].length, 5);
    for (const [index, source] of statement[0].Condition.ArnEquals['aws:SourceArn'].entries()) {
      const value = JSON.stringify(source);
      assert.ok(value.includes(`hireflux-${environment}-${suffixes[index]}`));
      assert.ok(!value.includes('*'));
    }
  });

  test(`${environment} monthly budget is exact project AND environment cost scope, without enforcement`, () => {
    assert.deepEqual(resources[ids.budget].Properties.Budget, {
      BudgetName: `hireflux-${environment}-monthly-cost`, BudgetType: 'COST', TimeUnit: 'MONTHLY',
      BudgetLimit: { Amount: config.operations.monthlyBudgetUsd, Unit: 'USD' }, Metrics: ['UNBLENDED_COST'],
      FilterExpression: { And: [
        { Tags: { Key: 'Project', Values: ['HireFlux'], MatchOptions: ['EQUALS'] } },
        { Tags: { Key: 'Environment', Values: [environment], MatchOptions: ['EQUALS'] } },
      ] },
    });
    // Tag activation/propagation is a documented deployment gate, not a synth lookup.
    assert.equal(resources[ids.budget].Properties.Budget.CostFilters, undefined);
    assert.doesNotMatch(JSON.stringify(resources), /BudgetsAction|AWS\/Billing|ce:|budgets:|ReservedConcurrentExecutions":0/);
  });

  test(`${environment} dashboard has six native metric graphs scoped to local function, API and table`, () => {
    const p = resolveTemplate(template, '')[ids.dashboard].Properties;
    assert.equal(p.DashboardName, `hireflux-${environment}-operations`);
    const body = JSON.parse(p.DashboardBody);
    assert.equal(body.start, '-PT6H');
    assert.equal(body.periodOverride, 'inherit');
    assert.equal(body.widgets.length, 6);
    const names = new Set<string>();
    let underlyingMetrics = 0;
    let visibleSeries = 0;
    for (const widget of body.widgets) {
      assert.equal(widget.type, 'metric');
      assert.equal(widget.properties.period, 300);
      assert.equal(widget.properties.region, 'us-east-1');
      assert.equal(widget.properties.liveData, undefined);
      let previous: string[] = [];
      for (const entry of widget.properties.metrics) {
        assert.ok(Array.isArray(entry));
        if (typeof entry[0] !== 'string') {
          assert.match(entry[0].expression, /^SUM\(\[(?:[te]\d,){5}[te]\d\]\)$/);
          visibleSeries += 1;
          continue;
        }
        const values = entry.map((value: any, index: number) => value === '.' ? previous[index] : value);
        previous = values;
        const [namespace, metric, dimension, value] = values;
        const options = typeof values.at(-1) === 'object' ? values.at(-1) : {};
        const expectedStatistic = ['Latency', 'IntegrationLatency', 'SuccessfulRequestLatency'].includes(metric)
          ? 'Average' : metric === 'Duration' ? 'p95' : metric === 'ConcurrentExecutions' ? 'Maximum' : 'Sum';
        assert.equal(options.stat ?? widget.properties.stat ?? 'Average', expectedStatistic);
        underlyingMetrics += 1;
        if (options.visible !== false) visibleSeries += 1;
        names.add(`${namespace}/${metric}`);
        if (namespace === 'AWS/ApiGateway') assert.deepEqual([dimension, value], ['ApiId', `resource:${ids.api}`]);
        else if (namespace === 'AWS/Lambda') assert.deepEqual([dimension, value], ['FunctionName', `resource:${ids.function}`]);
        else {
          assert.equal(namespace, 'AWS/DynamoDB');
          const dimensionMap = Object.fromEntries(values.slice(2).filter((value: any) => typeof value === 'string').reduce((pairs: string[][], value: string, index: number, source: string[]) => {
            if (index % 2 === 0) pairs.push([value, source[index + 1]!]); return pairs;
          }, []));
          assert.equal(dimensionMap.TableName, `resource:${ids.table}`);
          if (['ThrottledRequests', 'SystemErrors', 'SuccessfulRequestLatency'].includes(metric)) assert.ok(operations.includes(dimensionMap.Operation));
        }
      }
    }
    assert.equal(underlyingMetrics, 24);
    assert.equal(visibleSeries, 14);
    assert.deepEqual(body.widgets[3].properties.annotations.horizontal, [{
      value: config.operations.lambdaReservedConcurrency, label: 'Reserved concurrency', yAxis: 'right',
    }]);
    assert.deepEqual([...names].sort(), [
      'AWS/ApiGateway/Count', 'AWS/ApiGateway/4xx', 'AWS/ApiGateway/5xx', 'AWS/ApiGateway/Latency', 'AWS/ApiGateway/IntegrationLatency',
      'AWS/Lambda/Invocations', 'AWS/Lambda/Errors', 'AWS/Lambda/Throttles', 'AWS/Lambda/Duration', 'AWS/Lambda/ConcurrentExecutions',
      'AWS/DynamoDB/ThrottledRequests', 'AWS/DynamoDB/SystemErrors', 'AWS/DynamoDB/SuccessfulRequestLatency', 'AWS/DynamoDB/TransactionConflict',
    ].sort());
    assert.doesNotMatch(p.DashboardBody, /logsInsights|queryString|AWS\/Billing|SIGNING|secret|OperationalAlertEmail|AmplifyGitHubAccessToken/);
  });
}

test('access-log privacy validator rejects raw paths, personal and request content', () => {
  const template = Template.fromStack(new HireFluxStack(new App(), 'Privacy', loadEnvironmentConfig('staging'), fixtureArtifact)).toJSON();
  const safe = template.Resources[ids.stage].Properties.AccessLogSettings.Format;
  for (const value of ['$context.path', '$context.identity.sourceIp', '$context.identity.userAgent', '$context.authorizer.claims.email', 'Authorization', 'Cookie', 'queryString', 'requestBody', 'responseBody']) {
    assert.throws(() => assertAccessLogPrivacy(JSON.stringify({ ...JSON.parse(safe), extra: value })));
  }
});

test('DynamoDB alarm validation rejects table-only metrics that would silently miss data', () => {
  const template = Template.fromStack(new HireFluxStack(new App(), 'MetricScope', loadEnvironmentConfig('staging'), fixtureArtifact)).toJSON();
  const p = template.Resources[alarmIds[4]!].Properties;
  p.Metrics[1].MetricStat.Metric.Dimensions = [{ Name: 'TableName', Value: ref(ids.table) }];
  assert.throws(() => assertOperationAlarm(p, 'SystemErrors'));
});

test('operational constructs belong to independently bound environments with no shared references', () => {
  const app = new App();
  const staging = new HireFluxStack(app, 'HireFlux-staging', loadEnvironmentConfig('staging', '111111111111'), fixtureArtifact);
  const production = new HireFluxStack(app, 'HireFlux-production', loadEnvironmentConfig('production', '222222222222'), fixtureArtifact);
  assert.notEqual(staging.operationalLogs.backendFunctionLogs.logGroupArn, production.operationalLogs.backendFunctionLogs.logGroupArn);
  assert.notEqual(staging.operationalLogs.httpApiAccessLogs.logGroupArn, production.operationalLogs.httpApiAccessLogs.logGroupArn);
  assert.notEqual(staging.operations.alertTopic.ref, production.operations.alertTopic.ref);
  for (const stack of [staging, production]) {
    assert.equal(Stack.of(stack.operations), stack);
    assert.equal(Stack.of(stack.operationalLogs), stack);
    assert.equal(stack.dependencies.length, 0);
    const template = Template.fromStack(stack).toJSON();
    const other = stack === staging ? 'production' : 'staging';
    for (const id of [ids.topic, ids.topicPolicy, ids.dashboard, ids.budget, ...alarmIds]) {
      assert.ok(!JSON.stringify(template.Resources[id]).includes(`hireflux-${other}`));
    }
    assert.ok(!JSON.stringify(template).includes('Fn::ImportValue'));
  }
});
