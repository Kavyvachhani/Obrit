import { RESOURCE_TYPES, type ResourceType } from "../constants/resource-types.js";

/**
 * Build a direct link to the matching AWS Console page for a resource.
 * Returns undefined if the resource type isn't supported yet.
 */
export function buildConsoleLink(
  resourceType: ResourceType,
  region: string,
  resourceId: string,
  _arn?: string
): string | undefined {
  const base = `https://${region}.console.aws.amazon.com`;

  switch (resourceType) {
    case RESOURCE_TYPES.VPC:
      return `${base}/vpcconsole/home?region=${region}#VpcDetails:VpcId=${resourceId}`;

    case RESOURCE_TYPES.SUBNET:
      return `${base}/vpcconsole/home?region=${region}#SubnetDetails:subnetId=${resourceId}`;

    case RESOURCE_TYPES.ROUTE_TABLE:
      return `${base}/vpcconsole/home?region=${region}#RouteTableDetails:RouteTableId=${resourceId}`;

    case RESOURCE_TYPES.INTERNET_GATEWAY:
      return `${base}/vpcconsole/home?region=${region}#InternetGateway:internetGatewayId=${resourceId}`;

    case RESOURCE_TYPES.NAT_GATEWAY:
      return `${base}/vpcconsole/home?region=${region}#NatGatewayDetails:natGatewayId=${resourceId}`;

    case RESOURCE_TYPES.SECURITY_GROUP:
      return `${base}/vpcconsole/home?region=${region}#SecurityGroup:groupId=${resourceId}`;

    case RESOURCE_TYPES.NETWORK_INTERFACE:
      return `${base}/ec2/home?region=${region}#NetworkInterface:networkInterfaceId=${resourceId}`;

    case RESOURCE_TYPES.EC2_INSTANCE:
      return `${base}/ec2/home?region=${region}#InstanceDetails:instanceId=${resourceId}`;

    case RESOURCE_TYPES.LAMBDA_FUNCTION:
      return `${base}/lambda/home?region=${region}#/functions/${resourceId}`;

    case RESOURCE_TYPES.LOAD_BALANCER:
      // ALB/NLB ARN is needed for the console link; fall back to search
      return _arn
        ? `${base}/ec2/home?region=${region}#LoadBalancer:loadBalancerArn=${_arn}`
        : `${base}/ec2/home?region=${region}#LoadBalancers:search=${resourceId}`;

    case RESOURCE_TYPES.TARGET_GROUP:
      return _arn
        ? `${base}/ec2/home?region=${region}#TargetGroup:targetGroupArn=${_arn}`
        : `${base}/ec2/home?region=${region}#TargetGroups:search=${resourceId}`;

    case RESOURCE_TYPES.RDS_INSTANCE:
      return `${base}/rds/home?region=${region}#database:id=${resourceId};is-cluster=false`;

    case RESOURCE_TYPES.RDS_CLUSTER:
      return `${base}/rds/home?region=${region}#database:id=${resourceId};is-cluster=true`;

    case RESOURCE_TYPES.S3_BUCKET:
      return `https://s3.console.aws.amazon.com/s3/buckets/${resourceId}?region=${region}`;

    case RESOURCE_TYPES.IAM_ROLE:
      // IAM is global, no region prefix needed
      return `https://console.aws.amazon.com/iam/home#/roles/details/${resourceId}`;

    default:
      return undefined;
  }
}

/**
 * AWS regions with human-readable labels.
 */
export const AWS_REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-east-2", label: "US East (Ohio)" },
  { value: "us-west-1", label: "US West (N. California)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-west-1", label: "Europe (Ireland)" },
  { value: "eu-west-2", label: "Europe (London)" },
  { value: "eu-west-3", label: "Europe (Paris)" },
  { value: "eu-central-1", label: "Europe (Frankfurt)" },
  { value: "eu-north-1", label: "Europe (Stockholm)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { value: "ap-northeast-2", label: "Asia Pacific (Seoul)" },
  { value: "ap-northeast-3", label: "Asia Pacific (Osaka)" },
  { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
  { value: "sa-east-1", label: "South America (São Paulo)" },
  { value: "ca-central-1", label: "Canada (Central)" },
  { value: "me-south-1", label: "Middle East (Bahrain)" },
  { value: "af-south-1", label: "Africa (Cape Town)" },
] as const;
