# HARPY Helm Chart

Helm chart for deploying HARPY to Kubernetes clusters.

## Architecture

```mermaid
graph TB
    subgraph Kubernetes["☸️ Kubernetes Cluster"]
        subgraph Ingress["🌐 Ingress"]
            ING["Ingress Controller<br/>NGINX/Traefik"]
        end
        
        subgraph Services["🔧 HARPY Services"]
            RELAY["harpy-relay<br/>WebSocket: 8080"]
            INGEST["harpy-ingest<br/>HTTP: 8081"]
            FUSION["harpy-fusion<br/>HTTP: 8082"]
            GRAPH["harpy-graph<br/>HTTP: 8083"]
            AIP["harpy-aip<br/>HTTP: 8084"]
        end
        
        subgraph Storage["💾 Data Layer"]
            PG["PostgreSQL<br/>Subchart/External"]
            REDIS["Redis<br/>Subchart/External"]
            S3["S3/MinIO<br/>Object Storage"]
        end
        
        subgraph Config["⚙️ Configuration"]
            SECRETS["Kubernetes Secrets"]
            CM["ConfigMaps"]
        end
    end
    
    ING --> RELAY
    RELAY --> INGEST
    RELAY --> AIP
    INGEST --> FUSION
    FUSION --> GRAPH
    
    INGEST --> PG
    INGEST --> REDIS
    FUSION --> PG
    GRAPH --> PG
    INGEST --> S3
    
    SECRETS --> Services
    CM --> Services
```

## Installation

### Standard Installation

```bash
helm upgrade --install harpy deploy/helm/harpy \
  --namespace harpy \
  --create-namespace \
  --set secrets.DATABASE_URL='postgres://harpy:harpy@postgres:5432/harpy' \
  --set secrets.JWT_SECRET='replace-me' \
  --set secrets.REDIS_URL='redis://redis:6379'
```

### GovCloud Profile

```mermaid
graph TB
    subgraph Standard["🌐 Standard Deployment"]
        S_ING["Standard Ingress"]
        S_POD["Standard Pods"]
        S_SEC["Default Security"]
    end
    
    subgraph GovCloud["🏛️ GovCloud Deployment"]
        G_ING["Private Ingress"]
        G_POD["Hardened Pods<br/>non-root"]
        G_SEC["Enhanced Security<br/>seccomp"]
        G_NODE["Dedicated Nodes<br/>nodeSelector"]
    end
    
    HELM["Helm Chart"]
    
    HELM -->|values.yaml| Standard
    HELM -->|values-govcloud.yaml| GovCloud
```

```bash
helm upgrade --install harpy deploy/helm/harpy \
  --namespace harpy \
  --create-namespace \
  -f deploy/helm/harpy/values-govcloud.yaml
```

## Configuration

### Values Files

| File | Purpose |
|------|---------|
| `values.yaml` | Default configuration |
| `values-govcloud.yaml` | GovCloud hardening |
| `values-production.yaml` | Production overrides |
| `values-staging.yaml` | Staging overrides |

### Key Parameters

```mermaid
graph LR
    subgraph Config["⚙️ Configuration"]
        REPLICAS["replicaCount<br/>Pod replicas"]
        IMAGE["image.tag<br/>Container version"]
        RESOURCES["resources<br/>CPU/Memory limits"]
        INGRESS["ingress<br/>Domain/TLS config"]
        SECRETS["secrets<br/>DB, Redis, JWT"]
    end
    
    subgraph Values["📄 values.yaml"]
        V1["Global settings"]
        V2["Service-specific"]
    end
    
    V1 --> REPLICAS
    V1 --> IMAGE
    V2 --> RESOURCES
    V2 --> INGRESS
    V2 --> SECRETS
```

### Required Secrets

| Secret | Description |
|--------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | JWT signing secret |
| `S3_ACCESS_KEY` | S3/MinIO access key |
| `S3_SECRET_KEY` | S3/MinIO secret key |

## Upgrading

```bash
# Upgrade to new version
helm upgrade harpy deploy/helm/harpy \
  --namespace harpy \
  --set image.tag=v1.2.3

# Rollback
helm rollback harpy 1
```

## Uninstalling

```bash
helm uninstall harpy --namespace harpy
```
