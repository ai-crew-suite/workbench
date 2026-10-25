FROM grafana/grafana:13.2.4

COPY packages/deploy/containers/grafana/src/grafana-datasources.yaml /etc/grafana/provisioning/datasources/datasources.yaml
COPY packages/deploy/containers/grafana/src/grafana-dashboards.yaml /etc/grafana/provisioning/dashboards/dashboards.yaml
COPY packages/deploy/containers/grafana/src/dashboards /etc/grafana/provisioning/dashboards

EXPOSE 3000
