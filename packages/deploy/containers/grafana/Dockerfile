FROM grafana/grafana:13.2.4

ARG SRC_DIR=packages/deploy/containers/grafana/src
ARG DEST_DIR=/etc/grafana/provisioning

COPY ${SRC_DIR}/grafana-datasources.yaml ${DEST_DIR}/datasources/datasources.yaml
COPY ${SRC_DIR}/grafana-dashboards.yaml ${DEST_DIR}/dashboards/dashboards.yaml
COPY ${SRC_DIR}/dashboards ${DEST_DIR}/dashboards

EXPOSE 3000
