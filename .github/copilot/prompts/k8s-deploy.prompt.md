---
mode: "agent"
description: "Create or update Kubernetes manifests for HomeySmartHome deployment"
---

# Kubernetes Deployment

Create or update Kubernetes manifests in `k8s/`.

## Manifest Structure

### Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: smarthomepro
  labels:
    app: smarthomepro
spec:
  replicas: 2
  selector:
    matchLabels:
      app: smarthomepro
  template:
    metadata:
      labels:
        app: smarthomepro
    spec:
      containers:
        - name: smarthomepro
          image: ghcr.io/<org>/smarthomepro:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: "production"
          resources:
            limits:
              memory: "768Mi"
              cpu: "1500m"
            requests:
              memory: "256Mi"
              cpu: "250m"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          securityContext:
            runAsNonRoot: true
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
```

## Security Requirements
- `runAsNonRoot: true`
- `readOnlyRootFilesystem: true`
- `allowPrivilegeEscalation: false`
- Resource limits set on all containers
- Network policies restrict inter-pod communication

## Checklist
- [ ] Deployment, Service, and Ingress for each service
- [ ] Health and readiness probes configured
- [ ] Resource limits match Docker Compose values
- [ ] Security context is restrictive
- [ ] ConfigMap for environment variables
- [ ] Secret for sensitive values
- [ ] HPA for auto-scaling (optional)
