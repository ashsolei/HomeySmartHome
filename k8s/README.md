# Kubernetes Deployment Guide for Smart Home Pro

## Prerequisites

- Kubernetes cluster (v1.25+)
- kubectl CLI installed
- NGINX Ingress Controller
- cert-manager (optional, for TLS)
- Bitnami Sealed Secrets controller (required for secret management)

## Quick Start

### 1. Install Sealed Secrets controller

The cluster must have the Bitnami Sealed Secrets controller running before secrets can be decrypted.

```bash
# Install via Helm
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets \
  --namespace kube-system \
  --set fullnameOverride=sealed-secrets

# Verify the controller is running
kubectl get pods -n kube-system -l app.kubernetes.io/name=sealed-secrets
```

### 2. Seal your secrets

All Secret resources in `deployment.yaml` are represented as `SealedSecret` CRDs. The encrypted
values are cluster-specific — you must re-seal them for every cluster.

```bash
# Seal application credentials (HOMEY_TOKEN, JWT_SECRET)
kubectl create secret generic smarthome-secrets \
  --from-literal=HOMEY_TOKEN=<your-homey-token> \
  --from-literal=JWT_SECRET=<your-jwt-secret> \
  --dry-run=client -o yaml \
  | kubeseal --controller-namespace kube-system \
             --controller-name sealed-secrets \
             --format yaml

# Seal Alertmanager notification credentials
kubectl create secret generic alertmanager-secrets \
  --from-literal=smtp_password=<smtp-password> \
  --from-literal=webhook_token=<webhook-bearer-token> \
  --dry-run=client -o yaml \
  | kubeseal --controller-namespace kube-system \
             --controller-name sealed-secrets \
             --format yaml
```

Copy the `encryptedData` values from each command's output into the corresponding `SealedSecret`
blocks in `deployment.yaml`, replacing the `REPLACE_WITH_KUBESEAL_ENCRYPTED_VALUE` placeholders.

> **Important**: Sealed ciphertext is cluster-specific and non-transferable. Re-seal for each
> environment (dev, staging, prod). Never commit plaintext secret values.

### 3. Create namespace and deploy

```bash
# Apply all configurations (after sealing secrets above)
kubectl apply -f k8s/deployment.yaml

# Verify deployments
kubectl get pods -n smarthome-pro
kubectl get services -n smarthome-pro
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
kubectl logs -f -n smarthome-pro -l app=alertmanager
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

### Alertmanager

Alertmanager runs in the `smarthome-pro` namespace and receives alerts from Prometheus.
Notification routing is configured in `monitoring/alertmanager.yml` and mirrored into
the `alertmanager-config` ConfigMap in `deployment.yaml`.

Before deploying, update the following placeholders in the ConfigMap:

- `smtp.yourdomain.com` — your SMTP relay host and port
- `alertmanager@yourdomain.com` — the sender address
- `ops@yourdomain.com` — the recipient address for all severity levels
- `http://your-webhook-endpoint/alerts` — webhook URL for critical alerts (Slack, PagerDuty, etc.)

Port-forward to access the Alertmanager UI locally:

```bash
kubectl port-forward -n smarthome-pro service/alertmanager 9093:9093
# Open http://localhost:9093
```

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
