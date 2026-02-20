# HARPY GovCloud Overlay

This overlay applies additional hardening for GovCloud-style clusters:

- dedicated node scheduling via `nodeSelector` + `tolerations`
- runtime-default seccomp profile
- non-root pod runtime policy

Apply with:

```bash
kubectl apply -k deploy/k8s/govcloud
```
