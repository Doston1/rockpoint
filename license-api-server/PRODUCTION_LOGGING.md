# Production Logging Guide

## Overview

The RockPoint License Server uses Winston for structured logging with environment-aware configuration.

## Development Logging

- **Location**: `./logs/` directory in project root
- **Files**: `error.log`, `combined.log`
- **Rotation**: 10MB per file, max 10 files
- **Console**: Always enabled with colorized output

## Production Logging

### Option 1: Console-Only (Recommended for Docker/Cloud)

```bash
NODE_ENV=production npm start
```

- Logs only to console/stdout
- Perfect for Docker containers
- Cloud platforms can capture and route logs
- Examples: AWS CloudWatch, Google Cloud Logging, Azure Monitor

### Option 2: Custom Log Directory

```bash
NODE_ENV=production LOG_DIR=/var/log/rockpoint npm start
```

- Logs to specified directory
- Ensure directory exists and has write permissions
- Good for traditional server deployments

### Option 3: Centralized Logging

```bash
NODE_ENV=production LOG_LEVEL=info npm start | your-log-aggregator
```

## Environment Variables

### `LOG_LEVEL`

- **Values**: `error`, `warn`, `info`, `debug`
- **Default**: `info`
- **Example**: `LOG_LEVEL=debug`

### `LOG_DIR`

- **Purpose**: Custom log file directory (production only)
- **Default**: System temp directory if set
- **Example**: `LOG_DIR=/var/log/rockpoint`

### `NODE_ENV`

- **Values**: `development`, `production`
- **Impact**:
  - `development`: Files + console logging
  - `production`: Console only (unless LOG_DIR set)

## Docker Deployment Example

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
ENV NODE_ENV=production
ENV LOG_LEVEL=info
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
services:
  license-server:
    build: .
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - MONGODB_URI=mongodb://mongo:27017/licenses
    # Logs automatically captured by Docker
```

## Cloud Platform Integration

### AWS (ECS/Fargate)

- Logs automatically go to CloudWatch
- Use `awslogs` driver in task definition

### Google Cloud Run

- Logs automatically captured in Cloud Logging
- Filter by service name: `rockpoint-license-server`

### Azure Container Apps

- Logs go to Azure Monitor
- Use Log Analytics workspace for querying

## Log Format

### Development

```
2025-09-01 12:34:56 [info]: Server started on port 3002 {"port": 3002}
```

### Production (JSON)

```json
{
  "timestamp": "2025-09-01T12:34:56.789Z",
  "level": "info",
  "message": "Server started on port 3002",
  "service": "rockpoint-license-server",
  "version": "1.0.0",
  "environment": "production",
  "port": 3002
}
```

## Monitoring & Alerts

### Key Metrics to Monitor

- License validation requests
- Failed authentication attempts
- Database connection errors
- API response times

### Sample Log Queries

#### Failed license validations

```
level="error" AND message CONTAINS "License validation failed"
```

#### High error rate

```
level="error" | rate > 10/minute
```

#### Database issues

```
message CONTAINS "MongoDB" AND level IN ["error", "warn"]
```

## Security Considerations

1. **No Sensitive Data**: Logs never contain license keys, passwords, or PII
2. **Access Control**: Restrict log access to authorized personnel only
3. **Retention**: Set appropriate log retention policies (30-90 days)
4. **Encryption**: Use encrypted log storage in production

## Troubleshooting

### No logs appearing in production

1. Check `NODE_ENV` is set to `production`
2. Verify console output is being captured
3. Check if `LOG_DIR` has write permissions

### Log files not rotating

1. Ensure sufficient disk space
2. Check file permissions on log directory
3. Verify Winston configuration

### Performance impact

1. Reduce `LOG_LEVEL` to `warn` or `error` in high-traffic scenarios
2. Consider async logging for very high throughput
3. Monitor disk I/O if using file logging
