#!/bin/bash
set -e

echo "=== Configurando Lambda y API Gateway en LocalStack ==="

cd /etc/localstack/init/ready.d/lambda

# Instalar dependencias y compilar TypeScript
npm install
npm run build

# Empaquetar la función Lambda compilada (dist/) con dependencias de producción únicamente
rm -rf node_modules
npm install --production
zip -r /tmp/function.zip dist/ node_modules package.json

# Crear el rol IAM básico en LocalStack
awslocal iam create-role \
  --role-name lambda-ex \
  --assume-role-policy-document '{"Version": "2012-10-17","Statement": [{ "Effect": "Allow", "Principal": {"Service": "lambda.amazonaws.com"}, "Action": "sts:AssumeRole"}]}' || true

# Crear o actualizar la función Lambda
awslocal lambda create-function \
  --function-name DashboardMetricsFunction \
  --runtime nodejs20.x \
  --handler dist/app.handler \
  --memory-size 128 \
  --timeout 10 \
  --role arn:aws:iam::000000000000:role/lambda-ex \
  --zip-file fileb:///tmp/function.zip \
  --environment "Variables={DB_HOST=db,DB_PORT=5432,DB_USER=fixlat_user,DB_PASSWORD=fixlat_password,DB_NAME=fixlat_db}" || \
awslocal lambda update-function-code \
  --function-name DashboardMetricsFunction \
  --zip-file fileb:///tmp/function.zip

# Crear API Gateway REST API
API_ID=$(awslocal apigateway create-rest-api --name "DashboardApi" --query 'id' --output text)
PARENT_ID=$(awslocal apigateway get-resources --rest-api-id "$API_ID" --query 'items[0].id' --output text)

# Crear recurso /metrics
RESOURCE_ID=$(awslocal apigateway create-resource --rest-api-id "$API_ID" --parent-id "$PARENT_ID" --path-part "metrics" --query 'id' --output text)

# Crear método GET
awslocal apigateway put-method \
  --rest-api-id "$API_ID" \
  --resource-id "$RESOURCE_ID" \
  --http-method GET \
  --authorization-type "NONE"

# Integrar método con la función Lambda
awslocal apigateway put-integration \
  --rest-api-id "$API_ID" \
  --resource-id "$RESOURCE_ID" \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:000000000000:function:DashboardMetricsFunction/invocations"

# Desplegar API en etapa local
awslocal apigateway create-deployment --rest-api-id "$API_ID" --stage-name local

echo "=== LocalStack listo. Métricas disponibles en: http://localhost:4566/restapis/$API_ID/local/_user_request_/metrics ==="
