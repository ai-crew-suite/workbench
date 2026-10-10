# ====================================================================================
# 🏗️ PLATFORM IaC CORE BLUEPRINT
# Frameworks: SOC 2 Type II Network Perimeter Controls | HIPAA Audit Ready
# ====================================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# 🌐 1. Isolation Network Boundary (VPC)
resource "aws_vpc" "platform_network" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.environment}-platform-vpc"
    Environment = var.environment
  }
}

# 🐳 2. Secure Container Registry (ECR) for the Backstage Node 22 Images
resource "aws_ecr_repository" "backstage_images" {
  name                 = "${var.environment}-backstage-server"
  image_tag_mutability = "IMMUTABLE" # Prevents overwriting tags, establishing compliance tracking

  image_scanning_configuration {
    scan_on_push = true # Automatically runs vulnerability checks on push
  }

  tags = {
    Environment = var.environment
  }
}

# 🐘 3. Relational Storage Layer (RDS PostgreSQL for pgvector execution)
resource "aws_db_subnet_group" "db_subnets" {
  name       = "${var.environment}-db-subnet-group"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

resource "aws_db_instance" "platform_database" {
  identifier             = "${var.environment}-crew-platform-db"
  allocated_storage      = 20
  max_allocated_storage  = 100 # Auto-scaling engine tracking
  engine                 = "postgres"
  engine_version         = "17.1" # Standard PostgreSQL engine supporting pgvector 0.8+
  instance_class         = "db.t4g.medium"
  db_name                = "backstage_plugin_catalog"
  username               = "backstage"
  password               = var.database_secure_password
  db_subnet_group_name   = aws_db_subnet_group.db_subnets.name
  skip_final_snapshot    = var.environment == "dev" ? true : false
  storage_encrypted      = true # Mandatory KMS encryption for HIPAA and SOC 2 data protection

  tags = {
    Environment = var.environment
  }
}

# 🏎️ 4. Shared In-Memory Cache Stream Cluster (ElastiCache Redis)
resource "aws_elasticache_cluster" "platform_cache" {
  cluster_id           = "${var.environment}-crew-cache"
  engine               = "redis"
  node_type            = "cache.t4g.small"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
}

# Supporting mock network subnets to compile database groups cleanly
resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.platform_network.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "${var.aws_region}a"
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.platform_network.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "${var.aws_region}b"
}
