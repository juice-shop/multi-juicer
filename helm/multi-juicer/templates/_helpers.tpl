{{/* vim: set filetype=mustache: */}}
{{/*
Expand the name of the chart.
*/}}
{{- define "multi-juicer.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "multi-juicer.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
balancer labels
*/}}
{{- define "multi-juicer.balancer.labels" -}}
{{ include "multi-juicer.balancer.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/component: load-balancer
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}
{{- define "multi-juicer.balancer.selectorLabels" -}}
app.kubernetes.io/name: balancer
app.kubernetes.io/instance: balancer-{{ .Release.Name }}
app.kubernetes.io/part-of: multi-juicer
{{- end -}}

{{/*
juice-shop labels
*/}}
{{- define "multi-juicer.juice-shop.labels" -}}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/component: vulnerable-app
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/name: juice-shop
app.kubernetes.io/instance: juice-shop-{{ .Release.Name }}
app.kubernetes.io/part-of: multi-juicer
{{- end -}}

{{- define "multi-juicer.cookieName" -}}
{{- if .Values.balancer.cookie.secure -}}
{{- printf "__Secure-%s" .Values.balancer.cookie.name -}}
{{- else -}}
{{- printf "%s" .Values.balancer.cookie.name -}}
{{- end -}}
{{- end -}}