import { ArnFormat, Aws, CfnCondition, CfnParameter, Duration, Fn, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { CfnBudget } from 'aws-cdk-lib/aws-budgets';
import { Alarm, CfnAlarm, ComparisonOperator, Dashboard, GraphWidget, MathExpression, Metric, PeriodOverride, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import type { Table } from 'aws-cdk-lib/aws-dynamodb';
import type { Function } from 'aws-cdk-lib/aws-lambda';
import type { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import { LogGroup, LogGroupClass } from 'aws-cdk-lib/aws-logs';
import { CfnSubscription, CfnTopic, CfnTopicPolicy } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import type { HireFluxEnvironmentConfig } from '../config/environment';
import { explicitResourceName } from '../config/naming';

export const HTTP_ACCESS_LOG_FORMAT = JSON.stringify({
  requestId: '$context.requestId', routeKey: '$context.routeKey', httpMethod: '$context.httpMethod',
  status: '$context.status', responseLength: '$context.responseLength',
  responseLatency: '$context.responseLatency', integrationLatency: '$context.integrationLatency',
  protocol: '$context.protocol', integrationStatus: '$context.integration.status',
});

// The deployed adapters use these API operations. Table-only SystemErrors has no data.
export const DYNAMODB_OPERATIONS = Object.freeze([
  'GetItem', 'PutItem', 'DeleteItem', 'Query', 'BatchWriteItem', 'TransactWriteItems',
]);
const PERIOD = Duration.minutes(5);

/** Created before compute so no implicit infinite group or retention custom resource is needed. */
export class OperationalLogs extends Construct {
  public readonly backendFunctionLogs: LogGroup;
  public readonly httpApiAccessLogs: LogGroup;

  constructor(scope: Construct, id: string, config: HireFluxEnvironmentConfig) {
    super(scope, id);
    const common = { logGroupClass: LogGroupClass.STANDARD, removalPolicy: RemovalPolicy[config.operations.logRemovalPolicy] };
    this.backendFunctionLogs = new LogGroup(this, 'BackendFunctionLogs', {
      ...common, retention: config.operations.lambdaLogRetentionDays,
    });
    this.httpApiAccessLogs = new LogGroup(this, 'HttpApiAccessLogs', {
      ...common, retention: config.operations.apiLogRetentionDays,
    });
  }
}

export class OperationalGuardrails extends Construct {
  public readonly alarms: readonly Alarm[];
  public readonly dashboard: Dashboard;
  public readonly budget: CfnBudget;
  public readonly alertTopic: CfnTopic;

  constructor(scope: Construct, id: string, config: HireFluxEnvironmentConfig,
    backendFunction: Function, httpApi: HttpApi, table: Table,
    alertEmail: CfnParameter, hasAlertEmail: CfnCondition) {
    super(scope, id);
    const stack = Stack.of(this);
    const nativeMetric = (namespace: string, metricName: string, dimensionsMap: Record<string, string>, statistic = 'Sum') =>
      new Metric({ namespace, metricName, dimensionsMap, statistic, period: PERIOD });
    const lambda = (name: string, statistic = 'Sum') => nativeMetric('AWS/Lambda', name, { FunctionName: backendFunction.functionName }, statistic);
    const api = (name: string, statistic = 'Sum') => nativeMetric('AWS/ApiGateway', name, { ApiId: httpApi.apiId }, statistic);
    const dynamodb = (name: string, operation?: string, statistic = 'Sum') => nativeMetric('AWS/DynamoDB', name,
      { TableName: table.tableName, ...(operation ? { Operation: operation } : {}) }, statistic);
    const operationTotal = (name: string) => new MathExpression({
      expression: `SUM([${DYNAMODB_OPERATIONS.map((_, index) => `${name === 'ThrottledRequests' ? 't' : 'e'}${index}`).join(',')}])`,
      usingMetrics: Object.fromEntries(DYNAMODB_OPERATIONS.map((operation, index) => [`${name === 'ThrottledRequests' ? 't' : 'e'}${index}`, dynamodb(name, operation)])),
      period: PERIOD, label: `${name} (request operations)`,
    });
    const throttles = operationTotal('ThrottledRequests');
    const systemErrors = operationTotal('SystemErrors');
    const definitions = [
      { id: 'LambdaErrors', suffix: 'lambda-errors', metric: lambda('Errors'), threshold: 1, periods: 1, datapoints: 1 },
      { id: 'LambdaThrottles', suffix: 'lambda-throttles', metric: lambda('Throttles'), threshold: 1, periods: 1, datapoints: 1 },
      { id: 'HttpApiServerErrors', suffix: 'api-5xx', metric: api('5xx'), threshold: 1, periods: 1, datapoints: 1 },
      { id: 'DynamoDBThrottles', suffix: 'dynamodb-throttles', metric: throttles, threshold: 1, periods: 1, datapoints: 1 },
      { id: 'DynamoDBSystemErrors', suffix: 'dynamodb-system-errors', metric: systemErrors, threshold: 1, periods: 3, datapoints: 2 },
    ];
    this.alertTopic = new CfnTopic(this, 'OperationalAlerts', { topicName: explicitResourceName(config, 'operational-alerts') });
    this.alertTopic.cfnOptions.condition = hasAlertEmail;
    const subscription = new CfnSubscription(this, 'OperationalAlertSubscription', {
      protocol: 'email', endpoint: alertEmail.valueAsString, topicArn: this.alertTopic.ref,
    });
    subscription.cfnOptions.condition = hasAlertEmail;
    const topicPolicy = new CfnTopicPolicy(this, 'OperationalAlertPolicy', {
      topics: [this.alertTopic.ref], policyDocument: { Version: '2012-10-17', Statement: [{
        Effect: 'Allow', Principal: { Service: 'cloudwatch.amazonaws.com' }, Action: 'sns:Publish', Resource: this.alertTopic.ref,
        Condition: { StringEquals: { 'aws:SourceAccount': stack.account }, ArnEquals: {
          // Names avoid a policy → alarm → policy cycle while restricting every publisher.
          'aws:SourceArn': definitions.map(({ suffix }) => stack.formatArn({ service: 'cloudwatch', resource: 'alarm',
            resourceName: explicitResourceName(config, suffix), arnFormat: ArnFormat.COLON_RESOURCE_NAME })),
        } },
      }] },
    });
    topicPolicy.cfnOptions.condition = hasAlertEmail;
    this.alarms = Object.freeze(definitions.map(({ id: alarmId, suffix, metric, threshold, periods, datapoints }) => {
      const alarm = new Alarm(this, alarmId, {
        alarmName: explicitResourceName(config, suffix),
        alarmDescription: `${config.environmentName}: investigate ${suffix}; inspect scoped metrics and privacy-safe logs.`,
        metric, threshold, evaluationPeriods: periods, datapointsToAlarm: datapoints,
        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      });
      const resource = alarm.node.defaultChild as CfnAlarm;
      resource.alarmActions = [Fn.conditionIf(hasAlertEmail.logicalId, this.alertTopic.ref, Aws.NO_VALUE).toString()];
      return alarm;
    }));

    this.dashboard = new Dashboard(this, 'OperationalDashboard', {
      dashboardName: explicitResourceName(config, 'operations'), start: '-PT6H', periodOverride: PeriodOverride.INHERIT,
    });
    const graph = (title: string, left: (Metric | MathExpression)[], right: (Metric | MathExpression)[] = []) =>
      new GraphWidget({ title, left, right, width: 12, height: 6, period: PERIOD });
    this.dashboard.addWidgets(
      graph('HTTP API requests and responses', [api('Count'), api('4xx'), api('5xx')]),
      graph('HTTP API latency (ms)', [api('Latency', 'Average'), api('IntegrationLatency', 'Average')]),
      graph('Lambda invocations and failures', [lambda('Invocations'), lambda('Errors'), lambda('Throttles')]),
      new GraphWidget({ title: `Lambda runtime / concurrency (reservation ${config.operations.lambdaReservedConcurrency})`,
        left: [lambda('Duration', 'p95')], right: [lambda('ConcurrentExecutions', 'Maximum')],
        rightAnnotations: [{ value: config.operations.lambdaReservedConcurrency, label: 'Reserved concurrency' }],
        width: 12, height: 6, period: PERIOD }),
      graph('DynamoDB request throttles and system errors', [throttles, systemErrors]),
      graph('DynamoDB Query latency (ms) / transaction conflicts',
        [dynamodb('SuccessfulRequestLatency', 'Query', 'Average')], [dynamodb('TransactionConflict')]),
    );
    this.budget = new CfnBudget(this, 'MonthlyCostBudget', {
      budget: {
        budgetName: explicitResourceName(config, 'monthly-cost'), budgetType: 'COST', timeUnit: 'MONTHLY',
        budgetLimit: { amount: config.operations.monthlyBudgetUsd, unit: 'USD' }, metrics: ['UNBLENDED_COST'],
        filterExpression: { and: [
          { tags: { key: 'Project', values: ['HireFlux'], matchOptions: ['EQUALS'] } },
          { tags: { key: 'Environment', values: [config.environmentName], matchOptions: ['EQUALS'] } },
        ] },
      },
      resourceTags: Object.entries(config.tags).map(([key, value]) => ({ key, value })),
      notificationsWithSubscribers: Fn.conditionIf(hasAlertEmail.logicalId, [80, 100].map((threshold) => ({
        Notification: { ComparisonOperator: 'GREATER_THAN', NotificationType: 'ACTUAL', Threshold: threshold, ThresholdType: 'PERCENTAGE' },
        Subscribers: [{ Address: alertEmail.valueAsString, SubscriptionType: 'EMAIL' }],
      })), Aws.NO_VALUE),
    });
  }
}
