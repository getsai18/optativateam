# Lineamientos Técnicos y Rúbrica de Evaluación de Proyectos Finales

**Asignatura:** Optativa I \- Bases de Datos en la Nube&nbsp;

**Profesor**: Aldo Romero&nbsp;

**Entorno de Despliegue:** AWS Academy Learner Lab

---

## 1\. Consideraciones Generales y Restricciones del AWS Learner Lab

Dado que el entorno de desarrollo se ejecuta sobre **AWS Academy Learner Lab**, los proyectos deben adaptarse estrictamente a las siguientes restricciones operativas para garantizar la viabilidad del presupuesto (\$100 USD por cuatrimestre):

1. **Gestión de Sesiones e Credenciales:**

   * Las sesiones de laboratorio expiran tras un periodo de inactividad. Las aplicaciones no deben depender de direcciones IP públicas estáticas en las instancias (se debe usar nomenclatura o variables de entorno para actualizar endpoints de API Gateway o RDS).  
   * Se evalúa la automatización mediante scripts de despliegue o la flexibilidad para reconfigurar credenciales temporales de AWS (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`).  
2. **Optimización de Costos y Recursos:**

   * **RDS:** Instancias limitadas a `db.t3.micro` o `db.t4g.micro` con almacenamiento asignado no mayor a 20 GB (General Purpose SSD gp2/gp3). Se requiere apagar instancias RDS fuera de horario de trabajo para evitar el agotamiento prematuro del crédito.  
   * **DynamoDB:** Utilizar modo de capacidad bajo demanda (*On-Demand*) o capacidad aprovisionada en el nivel gratuito (`Read/Write Capacity Units` mínimos).  
   * **Lambda & API Gateway:** Mantener la memoria de las funciones Lambda configurada entre 128 MB y 256 MB.  
3. **Restricciones de IAM:**

   * Está prohibida la creación de roles de IAM con wildcard (`*`) irrestricto. Todos los roles ejecutados por Lambda o EC2 deben usar el rol preconfigurado `LabRole` o políticas con principio de mínimo privilegio sobre RDS y DynamoDB.

---

## 2\. Especificaciones Técnicas y Requerimientos por Proyecto

### Proyecto A: Sistema de Monitoreo y Predicción Climática

#### Focus en Base de Datos y Procesamiento

* **Volumen y Frecuencia:** Procesamiento mínimo de **10,000 registros semanales** (simulados mediante scripts de ingesta por lotes o APIs de clima).  
* **AWS DynamoDB:**  
  * Ingesta de alta velocidad para series temporales (temperatura, humedad, viento, precipitación, presión, etc.).  
  * Uso de clave compuesta: `Partition Key (PK)` \= `Ubicacion_ID`, `Sort Key (SK)` \= `Timestamp_UTC`.  
* **AWS RDS (3 Bases de Datos Relacionales):**  
  * **RDS 1 (Transaccional/Catálogos):** Mínimo 1 tablas (Usuarios, Ubicaciones/Estaciones, Roles, Logs de Auditoría, Configuración).  
  * **RDS 2 (Analytics/ML Staging):** Almacenamiento de agregaciones diarias/semanales, métricas de error (RMSE/MAE) y registros de predicción vs. clima real.  
  * **Garantizar interconexión de los datos entre las tres Bases de Datos**  
* **Stored Procedures (SP):** Mínimo **10 Stored Procedures** distribuidos en la capa de RDS para:  
  1. Agregación horaria/diaria de métricas climáticas.  
  2. Limpieza e identificación de registros anómalos o fuera de rango.  
  3. Cálculo de promedio móvil de variables meteorológicas.  
  4. Generación de tablas resumen para entrenamiento del modelo.  
  5. Rotación e historización de logs.

---

### Proyecto B: Sistema de Marketplace

#### Focus en Base de Datos y Arquitectura

* **Volumen:** Catálogo masivo de **al menos 17,000 productos** (vía script de ingesta masiva `BatchWriteItem` o ETL).  
* **Entidades y Modelado:**  
  * **Mínimo 10 Entidades Lógicas:** Usuarios, Vendedores, Productos, Categorías, Inventario, Carrito, Pedidos, Detalle\_Pedidos/Transacciones, Pagos, Reseñas/Direcciones.  
  * *Estrategia Relacional (RDS) u Optimizada (DynamoDB Single-Table Design):* Se acepta `Single-Table Design` en DynamoDB con claves compuestas (`PK`/`SK`) que representen las 10 entidades, O una arquitectura relacional completa en RDS (10+ tablas).  
* **Seguridad y Aislamiento de Datos:**  
  * Si se utilizan múltiples BDs en RDS, las credenciales/datos de pago deben aislarse con almacenamiento de contraseñas mediante hashing (`bcrypt`/`Argon2`) y tokenización de métodos de pago (sin guardar CVV ni tarjetas completas).  
* **Lógica Atómica / Stored Procedures / Transacciones:**  
  * Implementación de **al menos 3 procedimientos almacenados (SP en RDS)** O **3 Transacciones Atómicas en DynamoDB (`TransactWriteItems`)** ejecutadas desde Lambda para:  
    1. *Creación de Pedido y Descuento Transaccional de Inventario.*  
    2. *Cancelación de Pedido y Reabastecimiento Automático de Stock.*  
    3. *Generación de Consulta e Historial Consolidado de Ventas por Usuario/Vendedor.*

---

### Proyecto C: Sistema de Facturación y Servicios

#### Focus en Base de Datos y Cumplimiento

* **Volumen:** Carga sintética de **100 servicios** y **50 características** configurables.  
* **AWS RDS (Base Transaccional Principal):**  
  * Mínimo **8 tablas relacionales**: Clientes, Facturas, Detalle\_Factura, Servicios, Características\_Servicio, Pagos, Impuestos\_Histórico, Usuarios\_Roles.  
* **AWS DynamoDB:**  
  * Almacenamiento de logs de auditoría, sesiones activas, carritos temporales de facturación o registro de eventos inmutables.  
* **Stored Procedures (SP):** Mínimo **10 Stored Procedures** requeridos en RDS para:  
  1. Generación e iteración atómica de folios de factura.  
  2. Cálculo automático de Subtotal, IVA y Retenciones.  
  3. Aplicación de reglas de descuento por cliente o volumen.  
  4. Cancelación formal de facturas y reversión contable.  
  5. Cierre y consolidado fiscal diario/mensual.  
  6. Validación de estados de pago.  
  7. Reporte de antigüedad de saldos.  
  8. Generación de estructura para comprobante/timbrado.  
  9. Asignación masiva de características a servicios.  
  10. Auditoría de cambios en tarifas de servicios.

---

## 3\. Ponderación y Rúbrica de Evaluación Rigurosa

La evaluación se realizará sobre una escala de **0 a 100 puntos**, distribuidos en los siguientes 5 rubros obligatorios:

```
+----------------------------------------------------+---------+
| Criterio de Evaluación                             | Peso    |
+----------------------------------------------------+---------+
| 1. Diseño, Modelado y Rigor en Base de Datos        | 30%    |
| 2. Arquitectura en AWS y Optimización en Learner Lab| 25%    |
| 3. Lógica de Negocio y Stored Procedures / Transac. | 20%    |
| 4. Ciberseguridad, RBAC y Mitigación OWASP          | 15%    |
| 5. Frontend, Documentación y Control de Versiones   | 10%    |
+----------------------------------------------------+---------+
| TOTAL                                              | 100%    |
+----------------------------------------------------+---------+
```

---

### Detalle de Rúbrica por Rubro

#### 1\. Diseño, Modelado y Rigor en Base de Datos (30 Puntos)

* **Excelente (26 \- 30 pts):** Diagrama ER / Single-Table Schema perfectamente normalizado y respaldado. Cumple o supera el volumen de datos solicitado (10k registros clima / 17k productos / 100 servicios). Claves primarias, foráneas e índices secundarios (GSI/LSI en DynamoDB) optimizados correctamente.  
* **Suficiente (18 \- 25 pts):** Cumple con el volumen de datos y el número de tablas/entidades solicitadas, pero presenta redundancias menores en el modelo o falta de índices en campos de consulta frecuente.  
* **Insuficiente (0 \- 17 pts):** No alcanza el volumen mínimo de datos requeridos, faltan entidades clave o el diseño relacional/NoSQL rompe la integridad de los datos.

#### 2\. Arquitectura en AWS y Optimización en Learner Lab (25 Puntos)

* **Excelente (21 \- 25 pts):** Integración limpia entre API Gateway, Lambda/EC2, DynamoDB y RDS. Respeta las restricciones del Learner Lab (uso de `LabRole`, manejo eficiente de recursos para no agotar créditos). Variables de entorno bien configuradas.  
* **Suficiente (15 \- 20 pts):** La arquitectura funciona, pero existen configuraciones manuales o riesgos de agotamiento de presupuesto por instancias sobredimensionadas.  
* **Insuficiente (0 \- 14 pts):** Fallas continuas en la conexión con AWS, endpoints expuestos de forma insegura o incompatibilidad con las restricciones del laboratorio.

#### 3\. Lógica de Negocio, Stored Procedures y Transacciones (20 Puntos)

* **Excelente (17 \- 20 pts):** Todos los Stored Procedures (10 en Clima/Facturación) o Transacciones Atómicas (3 en Marketplace) están creados, probados y funcionan correctamente desde la aplicación, manejando transaccionalidad sin condiciones de carrera.  
* **Suficiente (11 \- 16 pts):** Procedimientos almacenados o transacciones parcialmente implementados o ejecutados manualmente fuera del flujo de la aplicación.  
* **Insuficiente (0 \- 10 pts):** No cumple con la cantidad solicitada de Stored Procedures / Transacciones atómicas o estos presentan errores sintácticos/lógicos.

#### 4\. Ciberseguridad, RBAC y Mitigación OWASP (15 Puntos)

* **Excelente (13 \- 15 pts):** Autenticación basada en tokens (JWT). Control de acceso basado en roles (RBAC) con permisos diferenciados. Protección demostrada contra inyección SQL, XSS y manejo seguro de secretos/contraseñas (hashing).  
* **Suficiente (8 \- 12 pts):** Manejo de roles funcional, pero con vulnerabilidades menores no críticas en validación de entradas.  
* **Insuficiente (0 \- 7 pts):** **PRESENCIA DE VULNERABILIDADES CRÍTICAS** (Inyección SQL directa, endpoints de edición/eliminación abiertos sin token, claves de AWS o credenciales escritas directamente en el código fuente frontend/backend).

#### 5\. Frontend, Documentación y Git (10 Puntos)

* **Excelente (9 \- 10 pts):** Interfaz web funcional, limpia y fluida. Repositorio de GitHub con historial de *commits* constante de todos los integrantes. Documentación técnica completa (Diagramas C4/ER, especificación OpenAPI/Swagger, manual de despliegue).  
* **Suficiente (6 \- 8 pts):** Interfaz funcional pero con detalles estéticos/UX. Documentación incompleta o baja frecuencia de commits en Git.  
* **Insuficiente (0 \- 5 pts):** Sin repositorio activo de código o incapacidad para desplegar la interfaz durante la demostración en vivo.

---

## 4\. Política de Entregables y Checklist Final

Para ser evaluados, los equipos deberán incluir en su repositorio oficial de GitHub los siguientes artefactos antes de la fecha límite:

1. **Directorio `/database`:**  
   * Script SQL de creación de tablas (DDL) y datos iniciales (DML).  
   * Script SQL independiente con la definición de los **Stored Procedures**.  
   * Script/JSON de esquema de **DynamoDB** y políticas de indexación.  
2. **Directorio `/docs`:**  
   * Diagrama Entidad-Relación (DER) actualizado.  
   * Diagrama de Arquitectura de AWS.  
   * Colección de Postman o especificación OpenAPI (Swagger) para pruebas de la API.  
3. **Código Fuente (`/src` o `/backend` / `/frontend`):**  
   * Código en Python (Flask/FastAPI/Lambda) y Frontend funcional.  
   * Archivo `README.md` con instrucciones detalladas para ejecutar las pruebas locales o conectar con los servicios en AWS Learner Lab.