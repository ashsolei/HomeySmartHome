# Kubernetes Deployment Guide for Smart Home Pro

## Prerequisites

- Kubernetes cluster (v1.25+)
- kubectl CLI installed
- NGINX Ingress Controller
- cert-manager (optional, for TLS)

## Quick Start

### 1. Create namespace and deploy

```bash
# Apply all configurations
kubectl apply -f k8s/deployment.yaml

# Verify deployments
kubectl get pods -n smarthome-pro
kubectl get services -n smarthome-pro
```

### 2. Update secrets

```bash
# Edit secrets with your actual values
kubectl edit secret smarthome-secrets -n smarthome-pro
```

### 3. Access the application

```bash
# Port-forward for local access
kubectl port-forward -n smarthome-pro service/dashboard 3001:3001

# Or access via ingress (update your DNS)
# https://smarthome.yourdomain.com
```

## Configuration

### Environment Variables

Edit the ConfigMap to customize:

```bash
kubectl edit configmap smarthome-config -n smarthome-pro
```

### Scaling

Manual scaling:
```bash
kubectl scale deployment smarthomepro --replicas=3 -n smarthome-pro
```

Auto-scaling is configured via HorizontalPodAutoscaler.

### Resource Limits

Adjust in `deployment.yaml`:
- Backend: 256Mi-768Mi memory, 0.5-1.5 CPU
- Dashboard: 128Mi-256Mi memory, 0.25-0.5 CPU

## Monitoring

### Check logs

```bash
kubectl logs -f -n smarthome-pro -l app=smarthomepro
kubectl logs -f -n smarthome-pro -l app=dashboard
```

### Check metrics

```bash
kubectl top pods -n smarthome-pro
kubectl top nodes
```

### Prometheus metrics

Access metrics at:
- Backend: http://smarthomepro:9090/metrics
- Dashboard: http://dashboard:3001/metrics

## Troubleshooting

### Pods not starting

```bash
kubectl describe pod <pod-name> -n smarthome-pro
kubectl logs <pod-name> -n smarthome-pro
```

### Service not accessible

```bash
kubectl get endpoints -n smarthome-pro
kubectl describe service smarthomepro -n smarthome-pro
```

### Ingress issues

```bash
kubectl describe ingress smarthome-ingress -n smarthome-pro
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

## Backup & Restore

### Backup PVCs

```bash
kubectl get pvc -n smarthome-pro
# Use your backup solution (Velero, etc.)
```

## Production Checklist

- [ ] Update secrets with production values
- [ ] Configure proper ingress domain
- [ ] Set up TLS certificates
- [ ] Configure resource limits based on load
- [ ] Set up monitoring and alerting
- [ ] Configure backup strategy
- [ ] Review security policies
- [ ] Set up log aggregation

## Clean Up

```bash
# Delete everything
kubectl delete namespace smarthome-pro
```
