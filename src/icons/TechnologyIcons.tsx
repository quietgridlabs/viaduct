/**
 * Technology marks.
 *
 * svgl first: it draws each brand as the brand itself draws it, and ships a
 * variant for a dark ground where the mark needs one — which devicons does
 * not, so a black wordmark used to disappear into the canvas.
 *
 * devicons stays for the ~35 marks svgl has no logo for (Jenkins, Prometheus,
 * RabbitMQ, gRPC, the service-mesh proxies, several older languages). Dropping
 * it wholesale would have traded a nicer set for a shorter one.
 */
import type { SVGProps } from "react";
import { useColorMode } from "@contexts/ColorModeContext";

import AnsibleOriginal from "devicons-react/icons/AnsibleOriginal";
import ApacheOriginal from "devicons-react/icons/ApacheOriginal";
import ArgocdOriginal from "devicons-react/icons/ArgocdOriginal";
import BitbucketOriginal from "devicons-react/icons/BitbucketOriginal";
import CassandraOriginal from "devicons-react/icons/CassandraOriginal";
import ClickhouseOriginal from "devicons-react/icons/ClickhouseOriginal";
import ClojureOriginal from "devicons-react/icons/ClojureOriginal";
import ConsulOriginal from "devicons-react/icons/ConsulOriginal";
import CouchdbOriginal from "devicons-react/icons/CouchdbOriginal";
import ElasticsearchOriginal from "devicons-react/icons/ElasticsearchOriginal";
import ElixirOriginal from "devicons-react/icons/ElixirOriginal";
import ErlangOriginal from "devicons-react/icons/ErlangOriginal";
import FsharpOriginal from "devicons-react/icons/FsharpOriginal";
import GroovyOriginal from "devicons-react/icons/GroovyOriginal";
import GrpcOriginal from "devicons-react/icons/GrpcOriginal";
import HelmOriginal from "devicons-react/icons/HelmOriginal";
import InfluxdbOriginal from "devicons-react/icons/InfluxdbOriginal";
import JenkinsOriginal from "devicons-react/icons/JenkinsOriginal";
import Neo4jOriginal from "devicons-react/icons/Neo4jOriginal";
import NimOriginal from "devicons-react/icons/NimOriginal";
import OktaOriginal from "devicons-react/icons/OktaOriginal";
import OpentelemetryOriginal from "devicons-react/icons/OpentelemetryOriginal";
import PerlOriginal from "devicons-react/icons/PerlOriginal";
import PrometheusOriginal from "devicons-react/icons/PrometheusOriginal";
import RabbitmqOriginal from "devicons-react/icons/RabbitmqOriginal";
import RailsOriginalWordmark from "devicons-react/icons/RailsOriginalWordmark";
import SplunkOriginalWordmark from "devicons-react/icons/SplunkOriginalWordmark";
import SymfonyOriginal from "devicons-react/icons/SymfonyOriginal";
import TraefikproxyOriginal from "devicons-react/icons/TraefikproxyOriginal";
import VaultOriginal from "devicons-react/icons/VaultOriginal";

import {
  Algolia,
  AmazonWebServicesDark,
  AmazonWebServicesLight,
  Angular,
  ApacheKafkaDark,
  ApacheKafkaLight,
  Auth0,
  BashDark,
  BashLight,
  Bootstrap,
  C,
  CPlusPlus,
  CSharp,
  Cloudflare,
  Dart,
  DigitalOcean,
  Django,
  Docker,
  Ember,
  ExpressjsDark,
  ExpressjsLight,
  FlaskDark,
  FlaskLight,
  Gatsby,
  GitHubDark,
  GitHubLight,
  GitLab,
  GoDark,
  GoLight,
  GoogleCloud,
  Grafana,
  Haskell,
  Heroku,
  Java,
  JavaScript,
  Kotlin,
  Kubernetes,
  Laravel,
  Lua,
  MariaDB,
  Matlab,
  MicrosoftAzure,
  MicrosoftSQLServer,
  MongoDBDark,
  MongoDBLight,
  MySQLDark,
  MySQLLight,
  NestJS,
  Netlify,
  Nextjs,
  Nginx,
  Nuxt,
  PhpDark,
  PhpLight,
  PostgreSQL,
  PowerShell,
  Python,
  RDark,
  RLight,
  ReactDark,
  ReactLight,
  Redis,
  Ruby,
  RustDark,
  RustLight,
  SQLite,
  Scala,
  Spring,
  Svelte,
  Swift,
  TailwindCSS,
  Terraform,
  TypeScript,
  VercelDark,
  VercelLight,
  VisualStudio,
  Vue,
} from "@ridemountainpig/svgl-react";

import {
  ArrowLeftRight,
  Cloud,
  CloudUpload,
  Folder,
  Globe,
  HardDrive,
  Lock,
  Monitor,
  Network,
  Server,
  Shield,
  Smartphone,
  User,
} from "lucide-react";

interface IconProps {
  size?: number;
  style?: React.CSSProperties;
}

type SvglIcon = (props: SVGProps<SVGSVGElement>) => React.JSX.Element;

/**
 * An svgl mark as the rest of the app expects one: sized by `size` rather than
 * by width and height, and picking its own variant.
 *
 * The suffix names the ground the mark is drawn for, not the mark — `Dark` is
 * the one with light ink, for a dark canvas. Built once per entry at module
 * level, because a component created per render remounts the icon on every
 * paint.
 */
function svgl(light: SvglIcon, dark?: SvglIcon): React.ComponentType<IconProps> {
  return function SvglMark({ size = 16, style }: IconProps) {
    const { mode } = useColorMode();
    const Mark = mode === "dark" && dark ? dark : light;
    return <Mark width={size} height={size} style={style} />;
  };
}

export const iconMap: Record<string, React.ComponentType<IconProps>> = {
  java: svgl(Java),
  javascript: svgl(JavaScript),
  typescript: svgl(TypeScript),
  python: svgl(Python),
  ruby: svgl(Ruby),
  php: svgl(PhpLight, PhpDark),
  c: svgl(C),
  cpp: svgl(CPlusPlus),
  csharp: svgl(CSharp),
  go: svgl(GoLight, GoDark),
  kotlin: svgl(Kotlin),
  swift: svgl(Swift),
  dart: svgl(Dart),
  rust: svgl(RustLight, RustDark),
  scala: svgl(Scala),
  perl: PerlOriginal,
  haskell: svgl(Haskell),
  elixir: ElixirOriginal,
  clojure: ClojureOriginal,
  erlang: ErlangOriginal,
  shell: svgl(BashLight, BashDark),
  powershell: svgl(PowerShell),
  r: svgl(RLight, RDark),
  matlab: svgl(Matlab),
  fsharp: FsharpOriginal,
  visualbasic: svgl(VisualStudio),
  lua: svgl(Lua),
  groovy: GroovyOriginal,
  nim: NimOriginal,
  postgresql: svgl(PostgreSQL),
  clickhouse: ClickhouseOriginal,
  mysql: svgl(MySQLLight, MySQLDark),
  mariadb: svgl(MariaDB),
  mongodb: svgl(MongoDBLight, MongoDBDark),
  redis: svgl(Redis),
  cassandra: CassandraOriginal,
  sqlserver: svgl(MicrosoftSQLServer),
  sqlite: svgl(SQLite),
  elasticsearch: ElasticsearchOriginal,
  neo4j: Neo4jOriginal,
  couchdb: CouchdbOriginal,
  influxdb: InfluxdbOriginal,
  docker: svgl(Docker),
  kubernetes: svgl(Kubernetes),
  terraform: svgl(Terraform),
  ansible: AnsibleOriginal,
  jenkins: JenkinsOriginal,
  github: svgl(GitHubLight, GitHubDark),
  gitlab: svgl(GitLab),
  bitbucket: BitbucketOriginal,
  argo: ArgocdOriginal,
  helm: HelmOriginal,
  react: svgl(ReactLight, ReactDark),
  angular: svgl(Angular),
  vue: svgl(Vue),
  nextjs: svgl(Nextjs),
  nuxtjs: svgl(Nuxt),
  svelte: svgl(Svelte),
  nestjs: svgl(NestJS),
  django: svgl(Django),
  rails: RailsOriginalWordmark,
  spring: svgl(Spring),
  flask: svgl(FlaskLight, FlaskDark),
  express: svgl(ExpressjsLight, ExpressjsDark),
  laravel: svgl(Laravel),
  symfony: SymfonyOriginal,
  bootstrap: svgl(Bootstrap),
  tailwind: svgl(TailwindCSS),
  gatsby: svgl(Gatsby),
  ember: svgl(Ember),
  kafka: svgl(ApacheKafkaLight, ApacheKafkaDark),
  rabbitmq: RabbitmqOriginal,
  prometheus: PrometheusOriginal,
  grafana: svgl(Grafana),
  splunk: SplunkOriginalWordmark,
  opentelemetry: OpentelemetryOriginal,
  auth0: svgl(Auth0),
  algolia: svgl(Algolia),
  cloudflare: svgl(Cloudflare),
  vault: VaultOriginal,
  okta: OktaOriginal,
  aws: svgl(AmazonWebServicesLight, AmazonWebServicesDark),
  azure: svgl(MicrosoftAzure),
  gcp: svgl(GoogleCloud),
  digitalocean: svgl(DigitalOcean),
  heroku: svgl(Heroku),
  vercel: svgl(VercelLight, VercelDark),
  netlify: svgl(Netlify),
  server: HardDrive,
  "database-server": Server,
  "client-device": Monitor,
  "mobile-device": Smartphone,
  router: Network,
  firewall: Shield,
  cloud: Cloud,
  vpn: Lock,
  storage: Folder,
  "load-balancer": ArrowLeftRight,
  nginx: svgl(Nginx),
  apache: ApacheOriginal,
  traefik: TraefikproxyOriginal,
  consul: ConsulOriginal,
  envoy: Network,
  kong: Globe,
  haproxy: ArrowLeftRight,
  caddy: Server,
  istio: Network,
  linkerd: Network,
  "aws-api-gateway": svgl(AmazonWebServicesLight, AmazonWebServicesDark),
  "azure-apim": svgl(MicrosoftAzure),
  apigee: svgl(GoogleCloud),
  http: Globe,
  https: Lock,
  tcp: Network,
  udp: Network,
  websocket: ArrowLeftRight,
  grpc: GrpcOriginal,
  mqtt: Network,
  amqp: Network,
  ftp: CloudUpload,
  sftp: CloudUpload,
  ssh: Shield,
  users: User,
  dns: Server,
  default: HardDrive,
};

export const getIconComponent = (
  iconName: string
): React.ComponentType<IconProps> => {
  return iconMap[iconName] || iconMap.default;
};
