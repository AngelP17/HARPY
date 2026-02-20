# HARPY Helm Chart

Install:

```bash
helm upgrade --install harpy deploy/helm/harpy \
  --namespace harpy \
  --create-namespace \
  --set secrets.DATABASE_URL='postgres://harpy:harpy@postgres:5432/harpy' \
  --set secrets.JWT_SECRET='replace-me'
```

GovCloud profile:

```bash
helm upgrade --install harpy deploy/helm/harpy \
  --namespace harpy \
  --create-namespace \
  -f deploy/helm/harpy/values-govcloud.yaml
```
