# Milvus Vector Database Container for Testing

We added Milvus as a vector store engine in the Platform repo. We should probably have containers with all vector store engines to test: Milvus, Pgvector, and Qdrant.

To run **Milvus** locally inside your Docker Compose matrix alongside components like Temporal, you cannot just spin up a single isolated container. Milvus operates as a distributed system and relies on **three core dependencies**:

1. **etcd:** For cluster metadata coordination and service discovery.
2. **MinIO (or AWS S3 Mock):** For object storage of data snapshots, logs, and pre-compiled index structures.
3. **Milvus Standalone:** The actual engine coordinator execution loop.

### The `docker-compose.yml` Configuration Block

Append these three unified services to your master **`packages/containers/docker-compose.yml`** file to seamlessly patch Milvus into your development cluster:

```yaml
version: '3.8'

services:
  # 1. Metadata Storage Coordinator
  milvus-etcd:
    image: quay.io/coreos/etcd:v3.5.16
    environment:
      - ETCD_AUTO_COMPACTION_RETENTION=1
    volumes:
      - milvus-etcd-data:/etcd
    command: etcd -advertise-client-urls=http://127.0.0.1:2379 -listen-client-urls=http://0.0.0 --data-dir /etcd
    healthcheck:
      test: ["CMD", "etcdctl", "endpoint", "health"]
      interval: 5s
      timeout: 3s
      retries: 3

  # 2. Object File Storage Engine
  milvus-minio:
    image: minio/minio:RELEASE.2024-10-02T17-50-41Z
    environment:
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    volumes:
      - milvus-minio-data:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      timeout: 3s
      retries: 3

  # 3. Main Milvus Engine Vector Coordinator
  milvus-standalone:
    image: milvusdb/milvus:v2.5.0
    command: ["milvus", "run", "standalone"]
    environment:
      ETCD_ENDPOINTS: milvus-etcd:2379
      MINIO_ADDRESS: milvus-minio:9000
    volumes:
      - milvus-standalone-data:/var/lib/milvus
    ports:
      - "19530:19530" # Core gRPC API port used by @zilliz/milvus2-sdk-node
      - "9091:9091"   # Management REST metrics endpoint
    depends_on:
      milvus-etcd:
        condition: service_healthy
      milvus-minio:
        condition: service_healthy

volumes:
  milvus-etcd-data:
  milvus-minio-data:
  milvus-standalone-data:
```

### Pairing it with your Backstage Configuration

Once your cluster is built using `yarn infra:up`, developers change their localized app configuration settings file to route all active pipeline workloads cleanly into Milvus via the gRPC endpoint:

```yaml
# app-config.local.yaml
vectorStore:
  type: 'milvus'
  milvus:
    address: 'localhost:19530' # Maps onto the forwarded Docker Compose bridg
```
